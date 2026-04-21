import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function convertAndImport() {
  console.log('🔄 Đang đọc file SQL cũ...');
  const sqlContent = fs.readFileSync('../converted.sql', 'utf8');

  // Regex to extract INSERT INTO blocks
  const insertRegex = /INSERT INTO `?([a-zA-Z0-9_]+)`?\s*\((.*?)\)\s*VALUES\s*([\s\S]*?);/g;
  let match;

  console.log('🧹 Đang làm sạch cơ sở dữ liệu Supabase để nhập dữ liệu cũ...');
  const tables = [
    'activity_logs', 'cart_items', 'compare_items', 'wishlist_items', 'order_items', 'orders',
    'product_reviews', 'product_variant_attributes', 'product_variants', 'product_images',
    'products', 'product_attributes', 'product_attribute_values',
    'categories', 'brands', 'coupons', 'inventory_transactions', 'shipping_zones', 'shipping_methods',
    'contact_messages', 'settings', 'addresses', 'users', 'banners', 'blog_posts'
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (e) {
      console.log(`Bỏ qua truncate ${table} (có thể chưa có)`);
    }
  }

  // Disable constraints for bulk import
  try {
     await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
     console.log('🔓 Tắt tạm thời kiểm tra khóa ngoại...');
  } catch(e) {}

  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    let columnsString = match[2].replace(/`/g, '');
    let columns = columnsString.split(',').map(c => c.trim());
    let valuesBlock = match[3];

    // Identify boolean columns
    const boolCols = [
      'isActive', 'isFeatured', 'isMaintenanceMode', 'isDefault', 
      'isRead', 'delivered', 'isPublished', 'isApproved', 'isPrimary',
      'is_active', 'is_featured', 'is_maintenance_mode', 'is_default',
      'is_read', 'is_published', 'is_approved', 'is_primary'
    ];
    let boolIndices = [];
    columns.forEach((col, idx) => {
      if (boolCols.includes(col)) boolIndices.push(idx);
    });

    // Parse and fix tuples
    let inString = false;
    let currentVal = '';
    let currentTuple = [];
    let modifiedTuples = [];
    
    for(let i=0; i<valuesBlock.length; i++) {
        let c = valuesBlock[i];
        if (c === "'" && valuesBlock[i-1] !== '\\') {
            inString = !inString;
            currentVal += c;
        } else if (c === ',' && !inString) {
            currentTuple.push(currentVal.trim());
            currentVal = '';
        } else if (c === '(' && !inString) {
            currentTuple = [];
            currentVal = '';
        } else if (c === ')' && !inString) {
            if (currentVal.trim() !== '') currentTuple.push(currentVal.trim());
            
            // Fix booleans
            for (let idx of boolIndices) {
                if (currentTuple[idx] === '1') currentTuple[idx] = 'true';
                if (currentTuple[idx] === '0') currentTuple[idx] = 'false';
            }
            
            // Fix string escaping for Postgres
            for (let j=0; j<currentTuple.length; j++) {
               if (currentTuple[j].startsWith("'")) {
                  currentTuple[j] = currentTuple[j].replace(/\\'/g, "''").replace(/\\"/g, '"');
               }
            }
            
            modifiedTuples.push(`(${currentTuple.join(', ')})`);
            currentVal = '';
        } else {
            currentVal += c;
        }
    }

    let pgValues = modifiedTuples.join(',\n');
    const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES ${pgValues};`;
    
    try {
      await prisma.$executeRawUnsafe(query);
      console.log(`✅ Đã nhập dữ liệu cho bảng: ${tableName}`);
    } catch (e) {
      console.error(`❌ Lỗi khi nhập vào bảng ${tableName}:`, e.message);
    }
  }

  // Restore constraints
  try {
     await prisma.$executeRawUnsafe(`SET session_replication_role = 'DEFAULT';`);
     console.log('🔒 Bật lại kiểm tra khóa ngoại...');
  } catch(e) {}
  
  // Fix sequences for identity columns
  console.log('📈 Cập nhật lại số thứ tự tự động (Sequence)...');
  for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 0) + 1, false) FROM "${table}";`);
      } catch(e) {}
  }

  console.log('🎉 Hoàn tất! Dữ liệu cũ đã được khôi phục thành công vào Supabase.');
  await prisma.$disconnect();
}

convertAndImport().catch(e => {
  console.error("Critical error:", e);
  prisma.$disconnect();
});

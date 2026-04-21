import { Router } from 'express';
import { authenticate, requireAdminAccess, requirePermission } from '../middlewares/auth.js';
import { adminController } from '../controllers/admin.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { activityController } from '../controllers/activity.controller.js';
import { staffController } from '../controllers/staff.controller.js';
import { reportController } from '../controllers/report.controller.js';
import { inventoryController } from '../controllers/inventory.controller.js';
import { bannerController } from '../controllers/banner.controller.js';
import { contactController } from '../controllers/contact.controller.js';
import { validate } from '../middlewares/validate.js';
import { adminContactReplySchema } from '../validators/commerce.validator.js';

const router = Router();

router.use(authenticate, requireAdminAccess);

// Lấy danh sách logs hoạt động
router.get('/activities', requirePermission('VIEW_ACTIVITY_LOGS'), activityController.getLogs);
router.post('/activities/:id/rollback', requirePermission('MANAGE_SETTINGS'), activityController.rollbackLog);

// Quản lý nhân viên (Staff)
router.get('/staffs', requirePermission('MANAGE_STAFF'), staffController.getStaffs);
router.post('/staffs', requirePermission('MANAGE_STAFF'), staffController.createStaff);
router.put('/staffs/:id', requirePermission('MANAGE_STAFF'), staffController.updateStaff);
router.delete('/staffs/:id', requirePermission('MANAGE_STAFF'), staffController.deleteStaff);

router.get('/reports', requirePermission('VIEW_REPORTS'), reportController.getStatistics);

router.get('/inventory', requirePermission('MANAGE_INVENTORY'), inventoryController.getInventoryHistory);
router.get('/inventory/stock', requirePermission('MANAGE_INVENTORY'), inventoryController.getStocks);
router.post('/inventory/update', requirePermission('MANAGE_INVENTORY'), inventoryController.updateStock);

router.get('/dashboard', adminController.getDashboard);
router.get('/products', requirePermission('MANAGE_PRODUCTS'), adminController.getProducts);
router.get('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.getProductById);
router.post('/products', requirePermission('MANAGE_PRODUCTS'), adminController.createProduct);
router.put('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateProduct);
router.delete('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteProduct);

router.get('/attributes', requirePermission('MANAGE_PRODUCTS'), adminController.getAttributes);
router.post('/attributes', requirePermission('MANAGE_PRODUCTS'), adminController.createAttribute);
router.put('/attributes/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateAttribute);
router.delete('/attributes/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteAttribute);

router.post('/attribute-values', requirePermission('MANAGE_PRODUCTS'), adminController.createAttributeValue);
router.put('/attribute-values/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateAttributeValue);
router.delete('/attribute-values/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteAttributeValue);

router.get('/categories', requirePermission('MANAGE_CATEGORIES'), adminController.getCategories);
router.post('/categories', requirePermission('MANAGE_CATEGORIES'), adminController.createCategory);
router.put('/categories/:id', requirePermission('MANAGE_CATEGORIES'), adminController.updateCategory);
router.delete('/categories/:id', requirePermission('MANAGE_CATEGORIES'), adminController.deleteCategory);

router.get('/brands', requirePermission('MANAGE_PRODUCTS'), adminController.getBrands);
router.post('/brands', requirePermission('MANAGE_PRODUCTS'), adminController.createBrand);
router.put('/brands/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateBrand);
router.delete('/brands/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteBrand);

router.get('/orders', requirePermission('MANAGE_ORDERS'), adminController.getOrders);
router.put('/orders/:id/status', requirePermission('MANAGE_ORDERS'), adminController.updateOrderStatus);
router.put('/orders/:id/payment-status', requirePermission('MANAGE_ORDERS'), adminController.updatePaymentStatus);

router.get('/customers', requirePermission('MANAGE_CUSTOMERS'), adminController.getCustomers);
router.get('/customers/stream', requirePermission('MANAGE_CUSTOMERS'), adminController.customerStatusStream);
router.get('/customers/:id/recent-orders', requirePermission('MANAGE_CUSTOMERS'), adminController.getCustomerRecentOrders);
router.put('/customers/:id/active', requirePermission('MANAGE_CUSTOMERS'), adminController.updateCustomerActive);

router.get('/coupons', requirePermission('MANAGE_COUPONS'), adminController.getCoupons);
router.post('/coupons/bulk-active', requirePermission('MANAGE_COUPONS'), adminController.bulkUpdateCouponActive);
router.post('/coupons', requirePermission('MANAGE_COUPONS'), adminController.createCoupon);
router.put('/coupons/:id/active', requirePermission('MANAGE_COUPONS'), adminController.updateCouponActive);
router.put('/coupons/:id', requirePermission('MANAGE_COUPONS'), adminController.updateCoupon);
router.delete('/coupons/:id', requirePermission('MANAGE_COUPONS'), adminController.deleteCoupon);

router.get('/shipping', requirePermission('MANAGE_SHIPPING'), adminController.getShippingMethods);
router.post('/shipping', requirePermission('MANAGE_SHIPPING'), adminController.createShippingMethod);
router.put('/shipping/:id', requirePermission('MANAGE_SHIPPING'), adminController.updateShippingMethod);
router.delete('/shipping/:id', requirePermission('MANAGE_SHIPPING'), adminController.deleteShippingMethod);

router.get('/blog', requirePermission('MANAGE_BLOG'), adminController.getBlogPosts);
router.post('/blog', requirePermission('MANAGE_BLOG'), adminController.createBlogPost);
router.put('/blog/:id', requirePermission('MANAGE_BLOG'), adminController.updateBlogPost);
router.delete('/blog/:id', requirePermission('MANAGE_BLOG'), adminController.deleteBlogPost);

// Reviews management
router.get('/reviews', requirePermission('MANAGE_REVIEWS'), reviewController.getAdminReviews);
router.post('/reviews/bulk-approve', requirePermission('MANAGE_REVIEWS'), reviewController.bulkApproveReviews);
router.post('/reviews/bulk-delete', requirePermission('MANAGE_REVIEWS'), reviewController.bulkDeleteReviews);
router.put('/reviews/:id/approve', requirePermission('MANAGE_REVIEWS'), reviewController.approveReview);
router.delete('/reviews/:id', requirePermission('MANAGE_REVIEWS'), reviewController.deleteReview);

// Banners
router.get('/banners', requirePermission('MANAGE_BANNERS'), bannerController.getAdminBanners);
router.post('/banners', requirePermission('MANAGE_BANNERS'), bannerController.createBanner);
router.put('/banners/:id', requirePermission('MANAGE_BANNERS'), bannerController.updateBanner);
router.delete('/banners/:id', requirePermission('MANAGE_BANNERS'), bannerController.deleteBanner);

// Contacts
router.get('/contacts', requirePermission('MANAGE_CONTACTS'), contactController.getMessages);
router.put('/contacts/:id/read', requirePermission('MANAGE_CONTACTS'), contactController.markRead);
router.post('/contacts/:id/reply', requirePermission('MANAGE_CONTACTS'), validate(adminContactReplySchema), contactController.replyMessage);
router.delete('/contacts/:id', requirePermission('MANAGE_CONTACTS'), contactController.deleteMessage);

export default router;

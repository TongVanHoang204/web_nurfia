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

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin management endpoints
 */

router.use(authenticate, requireAdminAccess);

/**
 * @swagger
 * /api/admin/activities:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin activity logs
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Activity logs }
 */
router.get('/activities', requirePermission('VIEW_ACTIVITY_LOGS'), activityController.getLogs);

/**
 * @swagger
 * /api/admin/activities/{id}/rollback:
 *   post:
 *     tags: [Admin]
 *     summary: Rollback an activity log
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Rollback executed }
 */
router.post('/activities/:id/rollback', requirePermission('MANAGE_SETTINGS'), activityController.rollbackLog);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard data }
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: Get all products (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Products list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a product
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201: { description: Product created }
 */
router.get('/products', requirePermission('MANAGE_PRODUCTS'), adminController.getProducts);
router.post('/products', requirePermission('MANAGE_PRODUCTS'), adminController.createProduct);

/**
 * @swagger
 * /api/admin/products/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get product by ID (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Product detail }
 *   put:
 *     tags: [Admin]
 *     summary: Update a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Product updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Product deleted }
 */
router.get('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.getProductById);
router.put('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateProduct);
router.delete('/products/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteProduct);

/**
 * @swagger
 * /api/admin/attributes:
 *   get:
 *     tags: [Admin]
 *     summary: Get product attributes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Attributes list }
 *   post:
 *     tags: [Admin]
 *     summary: Create an attribute
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Attribute created }
 */
router.get('/attributes', requirePermission('MANAGE_PRODUCTS'), adminController.getAttributes);
router.post('/attributes', requirePermission('MANAGE_PRODUCTS'), adminController.createAttribute);

/**
 * @swagger
 * /api/admin/attributes/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update an attribute
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Attribute updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete an attribute
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Attribute deleted }
 */
router.put('/attributes/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateAttribute);
router.delete('/attributes/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteAttribute);

/**
 * @swagger
 * /api/admin/attribute-values:
 *   post:
 *     tags: [Admin]
 *     summary: Create attribute value
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Attribute value created }
 */
router.post('/attribute-values', requirePermission('MANAGE_PRODUCTS'), adminController.createAttributeValue);

/**
 * @swagger
 * /api/admin/attribute-values/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update attribute value
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete attribute value
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/attribute-values/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateAttributeValue);
router.delete('/attribute-values/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteAttributeValue);

/**
 * @swagger
 * /api/admin/categories:
 *   get:
 *     tags: [Admin]
 *     summary: Get categories (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Categories list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a category
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Category created }
 */
router.get('/categories', requirePermission('MANAGE_CATEGORIES'), adminController.getCategories);
router.post('/categories', requirePermission('MANAGE_CATEGORIES'), adminController.createCategory);

/**
 * @swagger
 * /api/admin/categories/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/categories/:id', requirePermission('MANAGE_CATEGORIES'), adminController.updateCategory);
router.delete('/categories/:id', requirePermission('MANAGE_CATEGORIES'), adminController.deleteCategory);

/**
 * @swagger
 * /api/admin/brands:
 *   get:
 *     tags: [Admin]
 *     summary: Get brands (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Brands list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a brand
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Brand created }
 */
router.get('/brands', requirePermission('MANAGE_PRODUCTS'), adminController.getBrands);
router.post('/brands', requirePermission('MANAGE_PRODUCTS'), adminController.createBrand);

/**
 * @swagger
 * /api/admin/brands/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a brand
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a brand
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/brands/:id', requirePermission('MANAGE_PRODUCTS'), adminController.updateBrand);
router.delete('/brands/:id', requirePermission('MANAGE_PRODUCTS'), adminController.deleteBrand);

/**
 * @swagger
 * /api/admin/staffs:
 *   get:
 *     tags: [Admin]
 *     summary: Get staff list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Staff list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a staff account
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Staff created }
 */
router.get('/staffs', requirePermission('MANAGE_STAFF'), staffController.getStaffs);
router.post('/staffs', requirePermission('MANAGE_STAFF'), staffController.createStaff);

/**
 * @swagger
 * /api/admin/staffs/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a staff member
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a staff member
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/staffs/:id', requirePermission('MANAGE_STAFF'), staffController.updateStaff);
router.delete('/staffs/:id', requirePermission('MANAGE_STAFF'), staffController.deleteStaff);

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: Get report statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Report data }
 */
router.get('/reports', requirePermission('VIEW_REPORTS'), reportController.getStatistics);

/**
 * @swagger
 * /api/admin/inventory:
 *   get:
 *     tags: [Admin]
 *     summary: Get inventory history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Inventory history }
 */
router.get('/inventory', requirePermission('MANAGE_INVENTORY'), inventoryController.getInventoryHistory);

/**
 * @swagger
 * /api/admin/inventory/stock:
 *   get:
 *     tags: [Admin]
 *     summary: Get current stock levels
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stock data }
 */
router.get('/inventory/stock', requirePermission('MANAGE_INVENTORY'), inventoryController.getStocks);

/**
 * @swagger
 * /api/admin/inventory/update:
 *   post:
 *     tags: [Admin]
 *     summary: Update stock levels
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stock updated }
 */
router.post('/inventory/update', requirePermission('MANAGE_INVENTORY'), inventoryController.updateStock);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Get orders (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Orders list }
 */
router.get('/orders', requirePermission('MANAGE_ORDERS'), adminController.getOrders);

/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   put:
 *     tags: [Admin]
 *     summary: Update order status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Order status updated }
 */
router.put('/orders/:id/status', requirePermission('MANAGE_ORDERS'), adminController.updateOrderStatus);

/**
 * @swagger
 * /api/admin/orders/{id}/payment-status:
 *   put:
 *     tags: [Admin]
 *     summary: Update payment status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Payment status updated }
 */
router.put('/orders/:id/payment-status', requirePermission('MANAGE_ORDERS'), adminController.updatePaymentStatus);

/**
 * @swagger
 * /api/admin/customers:
 *   get:
 *     tags: [Admin]
 *     summary: Get customers list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Customers list }
 */
router.get('/customers', requirePermission('MANAGE_CUSTOMERS'), adminController.getCustomers);

/**
 * @swagger
 * /api/admin/customers/stream:
 *   get:
 *     tags: [Admin]
 *     summary: Stream customer status updates (SSE)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: SSE stream }
 */
router.get('/customers/stream', requirePermission('MANAGE_CUSTOMERS'), adminController.customerStatusStream);

/**
 * @swagger
 * /api/admin/customers/{id}/recent-orders:
 *   get:
 *     tags: [Admin]
 *     summary: Get customer recent orders
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Customer recent orders }
 */
router.get('/customers/:id/recent-orders', requirePermission('MANAGE_CUSTOMERS'), adminController.getCustomerRecentOrders);

/**
 * @swagger
 * /api/admin/customers/{id}/active:
 *   put:
 *     tags: [Admin]
 *     summary: Activate or deactivate a customer
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Customer status updated }
 */
router.put('/customers/:id/active', requirePermission('MANAGE_CUSTOMERS'), adminController.updateCustomerActive);

/**
 * @swagger
 * /api/admin/coupons:
 *   get:
 *     tags: [Admin]
 *     summary: Get coupons list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coupons list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a coupon
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Coupon created }
 */
router.get('/coupons', requirePermission('MANAGE_COUPONS'), adminController.getCoupons);
router.post('/coupons', requirePermission('MANAGE_COUPONS'), adminController.createCoupon);

/**
 * @swagger
 * /api/admin/coupons/bulk-active:
 *   post:
 *     tags: [Admin]
 *     summary: Bulk activate/deactivate coupons
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coupons updated }
 */
router.post('/coupons/bulk-active', requirePermission('MANAGE_COUPONS'), adminController.bulkUpdateCouponActive);

/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/coupons/:id', requirePermission('MANAGE_COUPONS'), adminController.updateCoupon);
router.delete('/coupons/:id', requirePermission('MANAGE_COUPONS'), adminController.deleteCoupon);

/**
 * @swagger
 * /api/admin/coupons/{id}/active:
 *   put:
 *     tags: [Admin]
 *     summary: Toggle coupon active status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Coupon active status updated }
 */
router.put('/coupons/:id/active', requirePermission('MANAGE_COUPONS'), adminController.updateCouponActive);

/**
 * @swagger
 * /api/admin/shipping:
 *   get:
 *     tags: [Admin]
 *     summary: Get shipping methods
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Shipping methods }
 *   post:
 *     tags: [Admin]
 *     summary: Create a shipping method
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Shipping method created }
 */
router.get('/shipping', requirePermission('MANAGE_SHIPPING'), adminController.getShippingMethods);
router.post('/shipping', requirePermission('MANAGE_SHIPPING'), adminController.createShippingMethod);

/**
 * @swagger
 * /api/admin/shipping/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a shipping method
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a shipping method
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/shipping/:id', requirePermission('MANAGE_SHIPPING'), adminController.updateShippingMethod);
router.delete('/shipping/:id', requirePermission('MANAGE_SHIPPING'), adminController.deleteShippingMethod);

/**
 * @swagger
 * /api/admin/blog:
 *   get:
 *     tags: [Admin]
 *     summary: Get blog posts (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Blog posts }
 *   post:
 *     tags: [Admin]
 *     summary: Create a blog post
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Blog post created }
 */
router.get('/blog', requirePermission('MANAGE_BLOG'), adminController.getBlogPosts);
router.post('/blog', requirePermission('MANAGE_BLOG'), adminController.createBlogPost);

/**
 * @swagger
 * /api/admin/blog/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a blog post
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a blog post
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/blog/:id', requirePermission('MANAGE_BLOG'), adminController.updateBlogPost);
router.delete('/blog/:id', requirePermission('MANAGE_BLOG'), adminController.deleteBlogPost);

/**
 * @swagger
 * /api/admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: Get all reviews (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Reviews list }
 */
router.get('/reviews', requirePermission('MANAGE_REVIEWS'), reviewController.getAdminReviews);

/**
 * @swagger
 * /api/admin/reviews/bulk-approve:
 *   post:
 *     tags: [Admin]
 *     summary: Bulk approve reviews
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Reviews approved }
 */
router.post('/reviews/bulk-approve', requirePermission('MANAGE_REVIEWS'), reviewController.bulkApproveReviews);

/**
 * @swagger
 * /api/admin/reviews/bulk-delete:
 *   post:
 *     tags: [Admin]
 *     summary: Bulk delete reviews
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Reviews deleted }
 */
router.post('/reviews/bulk-delete', requirePermission('MANAGE_REVIEWS'), reviewController.bulkDeleteReviews);

/**
 * @swagger
 * /api/admin/reviews/{id}/approve:
 *   put:
 *     tags: [Admin]
 *     summary: Approve a single review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Review approved }
 */
router.put('/reviews/:id/approve', requirePermission('MANAGE_REVIEWS'), reviewController.approveReview);

/**
 * @swagger
 * /api/admin/reviews/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Review deleted }
 */
router.delete('/reviews/:id', requirePermission('MANAGE_REVIEWS'), reviewController.deleteReview);

/**
 * @swagger
 * /api/admin/banners:
 *   get:
 *     tags: [Admin]
 *     summary: Get banners (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Banners list }
 *   post:
 *     tags: [Admin]
 *     summary: Create a banner
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Banner created }
 */
router.get('/banners', requirePermission('MANAGE_BANNERS'), bannerController.getAdminBanners);
router.post('/banners', requirePermission('MANAGE_BANNERS'), bannerController.createBanner);

/**
 * @swagger
 * /api/admin/banners/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update a banner
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a banner
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.put('/banners/:id', requirePermission('MANAGE_BANNERS'), bannerController.updateBanner);
router.delete('/banners/:id', requirePermission('MANAGE_BANNERS'), bannerController.deleteBanner);

/**
 * @swagger
 * /api/admin/contacts:
 *   get:
 *     tags: [Admin]
 *     summary: Get contact messages
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Messages list }
 */
router.get('/contacts', requirePermission('MANAGE_CONTACTS'), contactController.getMessages);

/**
 * @swagger
 * /api/admin/contacts/{id}/read:
 *   put:
 *     tags: [Admin]
 *     summary: Mark contact as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Marked as read }
 */
router.put('/contacts/:id/read', requirePermission('MANAGE_CONTACTS'), contactController.markRead);

/**
 * @swagger
 * /api/admin/contacts/{id}/reply:
 *   post:
 *     tags: [Admin]
 *     summary: Reply to a contact message
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reply sent }
 */
router.post('/contacts/:id/reply', requirePermission('MANAGE_CONTACTS'), validate(adminContactReplySchema), contactController.replyMessage);

/**
 * @swagger
 * /api/admin/contacts/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a contact message
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/contacts/:id', requirePermission('MANAGE_CONTACTS'), contactController.deleteMessage);

export default router;

import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.js';
import { orderController } from '../controllers/order.controller.js';

const router = Router();
router.use(authenticate);

router.post('/validate-coupon', requireCustomer, orderController.validateCoupon);
router.post('/shipping-options', requireCustomer, orderController.getShippingOptions);
router.post('/', requireCustomer, orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id/bank-transfer-proof', orderController.getBankTransferProof);
router.post('/:id/bank-transfer-proof', orderController.uploadBankTransferProof);
router.post('/:id/cancel', orderController.cancelOrder);
router.post('/:id/reorder', orderController.reorder);
router.get('/:id', orderController.getOrderById);

export default router;

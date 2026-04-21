import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { addressController } from '../controllers/address.controller.js';
import { validate } from '../middlewares/validate.js';
import { addressSchema } from '../validators/commerce.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', addressController.getAddresses);
router.post('/', validate(addressSchema), addressController.createAddress);
router.put('/:id', validate(addressSchema), addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

export default router;

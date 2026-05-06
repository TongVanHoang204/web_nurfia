import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { addressController } from '../controllers/address.controller.js';
import { validate } from '../middlewares/validate.js';
import { addressSchema } from '../validators/commerce.validator.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: Get user saved addresses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Addresses list }
 *   post:
 *     tags: [Addresses]
 *     summary: Create a new address
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, province, district, ward, streetAddress]
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               province: { type: string }
 *               district: { type: string }
 *               ward: { type: string }
 *               streetAddress: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201: { description: Address created }
 */
router.get('/', addressController.getAddresses);
router.post('/', validate(addressSchema), addressController.createAddress);

/**
 * @swagger
 * /api/addresses/{id}:
 *   put:
 *     tags: [Addresses]
 *     summary: Update an address
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               province: { type: string }
 *               district: { type: string }
 *               ward: { type: string }
 *               streetAddress: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       200: { description: Address updated }
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete an address
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Address deleted }
 */
router.put('/:id', validate(addressSchema), addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

export default router;

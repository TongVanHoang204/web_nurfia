import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { deleteStoredFiles, ensureStoredFileMatchesMimeSignature } from '../utils/uploadValidation.js';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dv62li92i',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadController = {
  uploadSingle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded.' });
        return;
      }

      if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        await deleteStoredFiles([req.file.path]);
        throw new AppError('Cloudinary API Key hoac Secret chua duoc cau hinh tren Render.', 500);
      }

      const isValidSignature = await ensureStoredFileMatchesMimeSignature(req.file.path, req.file.mimetype);
      if (!isValidSignature) {
        await deleteStoredFiles([req.file.path]);
        throw new AppError('Uploaded file content does not match the declared file type.', 400);
      }

      // Upload direct to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'nurfia_uploads',
        resource_type: 'auto'
      });
      
      // Cleanup locally
      await deleteStoredFiles([req.file.path]);

      res.json({ success: true, data: { url: result.secure_url, filename: result.public_id } });
    } catch (err: any) {
      if (req.file) await deleteStoredFiles([req.file.path]).catch(() => {});
      next(err);
    }
  },

  uploadMultiple: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files uploaded.' });
        return;
      }

      if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        await deleteStoredFiles(files.map(f => f.path));
        throw new AppError('Cloudinary API Key hoac Secret chua duoc cau hinh tren Render.', 500);
      }

      const validationResults = await Promise.all(files.map(async (file) => ({
        file,
        isValid: await ensureStoredFileMatchesMimeSignature(file.path, file.mimetype),
      })));

      if (validationResults.some((result) => !result.isValid)) {
        await deleteStoredFiles(files.map(f => f.path));
        throw new AppError('One or more uploaded files do not match the declared file type.', 400);
      }

      const uploadPromises = files.map(async (f) => {
        const result = await cloudinary.uploader.upload(f.path, {
          folder: 'nurfia_uploads',
          resource_type: 'auto'
        });
        return { url: result.secure_url, filename: result.public_id };
      });

      const urls = await Promise.all(uploadPromises);
      
      // Cleanup locally
      await deleteStoredFiles(files.map(f => f.path));

      res.json({ success: true, data: urls });
    } catch (err) {
      const files = req.files as Express.Multer.File[] || [];
      await deleteStoredFiles(files.map(f => f.path)).catch(() => {});
      next(err);
    }
  }
};

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { deleteStoredFiles, ensureStoredFileMatchesMimeSignature } from '../utils/uploadValidation.js';

export const uploadController = {
  uploadSingle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded.' });
        return;
      }

      const isValidSignature = await ensureStoredFileMatchesMimeSignature(req.file.path, req.file.mimetype);
      if (!isValidSignature) {
        await deleteStoredFiles([req.file.path]);
        throw new AppError('Uploaded file content does not match the declared file type.', 400);
      }

      const url = `/uploads/${req.file.filename}`;
      res.json({ success: true, data: { url, filename: req.file.filename } });
    } catch (err) {
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

      const validationResults = await Promise.all(files.map(async (file) => ({
        file,
        isValid: await ensureStoredFileMatchesMimeSignature(file.path, file.mimetype),
      })));

      if (validationResults.some((result) => !result.isValid)) {
        await deleteStoredFiles(files.map((file) => file.path));
        throw new AppError('One or more uploaded files do not match the declared file type.', 400);
      }

      const urls = files.map((f: Express.Multer.File) => ({ url: `/uploads/${f.filename}`, filename: f.filename }));
      res.json({ success: true, data: urls });
    } catch (err) {
      next(err);
    }
  }
};

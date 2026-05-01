import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { deleteStoredFiles, ensureStoredFileMatchesMimeSignature } from '../utils/uploadValidation.js';
import { uploadToFTP } from '../utils/ftp.js';

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

      // Đẩy file lên Hosting DirectAdmin qua FTP
      const remoteUrl = await uploadToFTP(req.file.path, req.file.filename);
      // Cố gắng xóa file tạm sau khi tải lên thành công để tránh tốn dung lượng Render
      await deleteStoredFiles([req.file.path]).catch(() => {});

      res.json({ success: true, data: { url: remoteUrl, filename: req.file.filename } });
    } catch (err) {
      // Nếu có lỗi FTP, nhớ xóa file local
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

      const validationResults = await Promise.all(files.map(async (file) => ({
        file,
        isValid: await ensureStoredFileMatchesMimeSignature(file.path, file.mimetype),
      })));

      if (validationResults.some((result) => !result.isValid)) {
        await deleteStoredFiles(files.map((file) => file.path));
        throw new AppError('One or more uploaded files do not match the declared file type.', 400);
      }

      // Tải nhiều file lên Hosting qua FTP song song
      const urls = await Promise.all(files.map(async (f: Express.Multer.File) => {
        const remoteUrl = await uploadToFTP(f.path, f.filename);
        return { url: remoteUrl, filename: f.filename };
      }));

      // Xóa các file tạm
      await deleteStoredFiles(files.map(f => f.path)).catch(() => {});

      res.json({ success: true, data: urls });
    } catch (err) {
      const files = req.files as Express.Multer.File[] || [];
      await deleteStoredFiles(files.map(f => f.path)).catch(() => {});
      next(err);
    }
  }
};

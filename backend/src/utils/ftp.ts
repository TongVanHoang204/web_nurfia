import * as ftp from 'basic-ftp';
export const uploadToFTP = async (localFilePath: string, remoteFilename: string): Promise<string> => {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const ftpHost = process.env.FTP_HOST || '103.249.116.165';
  const ftpUser = process.env.FTP_USER || 'vanhoang';
  const ftpPass = process.env.FTP_PASS;

  if (!ftpPass) {
    throw new Error('Vui lòng cấu hình biến môi trường FTP_PASS chứa mật khẩu.');
  }

  const ftpDomainUrl = process.env.FTP_DOMAIN_URL || 'http://vanhoang.mauweb68.com';
  const ftpDestFolder = process.env.FTP_DEST_FOLDER || '/domains/vanhoang.mauweb68.com/public_html/uploads';

  try {
    await client.access({
      host: ftpHost,
      user: ftpUser,
      password: ftpPass,
      secure: false
    });

    await client.ensureDir(ftpDestFolder);
    await client.uploadFrom(localFilePath, remoteFilename);
    return ftpDomainUrl + '/uploads/' + remoteFilename;
  } catch (err: any) {
    throw new Error('Lỗi upload: ' + err.message);
  } finally {
    client.close();
  }
};

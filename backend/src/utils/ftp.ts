import * as ftp from 'basic-ftp';

const requireEnv = (key: string) => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`Missing required FTP environment variable: ${key}.`);
  }
  return value;
};

export const uploadToFTP = async (localFilePath: string, remoteFilename: string): Promise<string> => {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const ftpHost = requireEnv('FTP_HOST');
  const ftpUser = requireEnv('FTP_USER');
  const ftpPass = requireEnv('FTP_PASS');
  const ftpDomainUrl = requireEnv('FTP_DOMAIN_URL').replace(/\/+$/, '');
  const ftpDestFolder = requireEnv('FTP_DEST_FOLDER');
  const ftpSecure = process.env.FTP_SECURE !== 'false';

  try {
    await client.access({
      host: ftpHost,
      user: ftpUser,
      password: ftpPass,
      secure: ftpSecure,
    });

    await client.ensureDir(ftpDestFolder);
    await client.uploadFrom(localFilePath, remoteFilename);
    return `${ftpDomainUrl}/uploads/${encodeURIComponent(remoteFilename)}`;
  } catch (err: any) {
    throw new Error(`FTP upload failed: ${err.message}`);
  } finally {
    client.close();
  }
};

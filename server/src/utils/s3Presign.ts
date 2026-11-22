import crypto from 'crypto';

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export interface S3PresignConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export function getS3Config(): S3PresignConfig | null {
  const endpoint = String(process.env.S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  const bucket = String(process.env.S3_BUCKET || '').trim();
  const region = String(process.env.S3_REGION || 'auto').trim();
  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || '').trim();
  const publicBaseUrl = String(process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }

  return { endpoint, bucket, region, accessKeyId, secretAccessKey, publicBaseUrl };
}

export function createPresignedPutUrl(
  config: S3PresignConfig,
  objectKey: string,
  expiresSec = 900
): { presignedUrl: string; publicUrl: string } {
  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const cleanKey = objectKey.replace(/^\/+/, '');
  const encodedPathSegments = [config.bucket, ...cleanKey.split('/')]
    .filter(Boolean)
    .map(encodeRfc3986);
  const basePath = endpointUrl.pathname.replace(/\/+$/, '');
  const canonicalUri = `${basePath}/${encodedPathSegments.join('/')}`;

  const queryParams: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSec)],
    ['X-Amz-SignedHeaders', 'host'],
  ];

  const canonicalQueryString = queryParams
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalHeaders = `host:${endpointUrl.host}\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const presignedUrl = `${endpointUrl.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const publicUrl = `${config.publicBaseUrl}/${cleanKey}`;

  return { presignedUrl, publicUrl };
}

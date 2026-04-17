import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as cheerio from 'cheerio';

const SCHOLAR_USER_ID = process.env.SCHOLAR_USER_ID || 'AFD0pYEAAAAJ';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_KEY = 'data/westwood-publications.json';

if (!S3_BUCKET) {
  throw new Error('S3_BUCKET environment variable is required');
}

const s3Client = new S3Client({ region: 'us-east-1' });

async function getScholarStats(userId) {
  const url = `https://scholar.google.com/citations?user=${userId}&hl=en`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for url: ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Find citation stats - they're in a table with class gsc_rsb_std
  const citationElements = $('.gsc_rsb_std');

  if (citationElements.length < 3) {
    throw new Error('Could not find citation elements on page');
  }

  const citations = parseInt($(citationElements[0]).text(), 10);
  const hIndex = parseInt($(citationElements[2]).text(), 10);

  return { citations, hIndex };
}

async function updateProfileJson(stats) {
  // Get current file from S3
  const getCommand = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: S3_KEY,
  });

  const response = await s3Client.send(getCommand);
  const bodyString = await response.Body.transformToString();
  const data = JSON.parse(bodyString);

  // Update stats
  data.profile.googleCitations = stats.citations;
  data.profile.hIndex = stats.hIndex;
  data.profile.citationsLastUpdated = new Date().toISOString().split('T')[0];

  // Upload back to S3
  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: S3_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  });

  await s3Client.send(putCommand);

  return data.profile;
}

export async function handler(event) {
  try {
    console.log('Fetching Google Scholar stats...');
    const stats = await getScholarStats(SCHOLAR_USER_ID);
    console.log(`Got stats: ${stats.citations} citations, h-index ${stats.hIndex}`);

    console.log('Updating S3...');
    const updatedProfile = await updateProfileJson(stats);
    console.log('Successfully updated profile');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully updated scholar stats',
        citations: stats.citations,
        hIndex: stats.hIndex,
        lastUpdated: updatedProfile.citationsLastUpdated,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

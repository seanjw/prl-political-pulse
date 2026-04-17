#!/usr/bin/env node

/**
 * Script to scrape news articles from polarizationresearchlab.org
 * and save them as markdown files with locally downloaded images.
 *
 * Usage: node scripts/scrape-news.mjs
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'news');
const ARTICLES_DIR = path.join(OUTPUT_DIR, 'articles');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const BASE_URL = 'https://polarizationresearchlab.org';

// Configure Turndown for better Markdown conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Remove unwanted elements from markdown
turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside']);

/**
 * Clean up WordPress-specific junk from markdown content
 */
function cleanMarkdown(markdown) {
  return markdown
    // Remove "Like this:" and "Share this:" sections
    .replace(/### Like this:[\s\S]*?Like Loading\.\.\.[\s\S]*?$/gm, '')
    .replace(/### Share this:[\s\S]*?(?=###|$)/gm, '')
    .replace(/Like Loading\.\.\./g, '')
    // Remove empty widget placeholder text
    .replace(/You need to add a widget.*?🙂/g, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')     // Replace spaces with dashes
    .replace(/-+/g, '-')      // Replace multiple dashes with single
    .replace(/^-|-$/g, '')    // Remove leading/trailing dashes
    .substring(0, 80);        // Limit length
}

/**
 * Extract category from URL path (e.g., "report", "blog", "news")
 */
function extractCategory(url) {
  const match = url.match(/\/(report|blog|news|commentary|research-article)-/i);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  }
  return 'Article';
}

/**
 * Download an image to the local images directory
 */
async function downloadImage(imageUrl, slug, index) {
  try {
    // Handle relative URLs
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${BASE_URL}${imageUrl}`;

    // Extract extension from URL or default to jpg
    const urlPath = new URL(fullUrl).pathname;
    const ext = path.extname(urlPath) || '.jpg';
    const filename = `${slug}-${index}${ext}`;
    const localPath = path.join(IMAGES_DIR, filename);

    // Skip if already exists
    if (existsSync(localPath)) {
      console.log(`  Image already exists: ${filename}`);
      return `/news/images/${filename}`;
    }

    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.warn(`  Failed to download image: ${fullUrl}`);
      return imageUrl; // Return original URL if download fails
    }

    const buffer = await response.arrayBuffer();
    await writeFile(localPath, Buffer.from(buffer));
    console.log(`  Downloaded: ${filename}`);

    return `/news/images/${filename}`;
  } catch (error) {
    console.warn(`  Error downloading image: ${imageUrl}`, error.message);
    return imageUrl; // Return original URL on error
  }
}

/**
 * Fetch articles from a single archive page
 */
async function fetchArchivePage(url) {
  const articles = [];

  try {
    const response = await fetch(url);
    if (!response.ok) return { articles: [], hasMore: false };

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find article links with date pattern in URL
    $('a[href*="polarizationresearchlab.org"]').each((_, element) => {
      const articleUrl = $(element).attr('href');

      // Check if it's an article URL with date pattern
      if (!articleUrl || !articleUrl.match(/\/\d{4}\/\d{2}\/\d{2}\//)) return;

      const title = $(element).text().trim();
      if (!title || title.length < 10) return;

      // Skip navigation/menu links
      if (title.toLowerCase().includes('read more') || title.toLowerCase().includes('continue reading')) return;

      articles.push({
        url: articleUrl,
        title,
        dateText: '',
        thumbnail: null,
      });
    });

    // Check for pagination (older posts link or page/N pattern)
    const hasMore = $('a[href*="/page/"]').length > 0 ||
                    $('a:contains("older posts")').length > 0 ||
                    $('a:contains("Older")').length > 0;

    return { articles, hasMore };
  } catch (error) {
    console.warn(`  Error fetching ${url}: ${error.message}`);
    return { articles: [], hasMore: false };
  }
}

/**
 * Fetch and parse all articles from yearly archives
 */
async function fetchArticleList() {
  console.log('Fetching articles from yearly archives...\n');

  const allArticles = [];
  const currentYear = new Date().getFullYear();
  const startYear = 2022; // PRL started publishing around this time

  // Iterate through years
  for (let year = currentYear; year >= startYear; year--) {
    console.log(`Scanning ${year}...`);
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = page === 1
        ? `${BASE_URL}/${year}/`
        : `${BASE_URL}/${year}/page/${page}/`;

      const result = await fetchArchivePage(url);

      if (result.articles.length === 0) {
        hasMore = false;
      } else {
        allArticles.push(...result.articles);
        console.log(`  Page ${page}: found ${result.articles.length} articles`);
        hasMore = result.hasMore && page < 10; // Safety limit
        page++;
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Remove duplicates by URL
  const uniqueArticles = [];
  const seenUrls = new Set();
  for (const article of allArticles) {
    if (!seenUrls.has(article.url)) {
      seenUrls.add(article.url);
      uniqueArticles.push(article);
    }
  }

  console.log(`\nFound ${uniqueArticles.length} unique articles total`);
  return uniqueArticles;
}

/**
 * Fetch and parse an individual article page
 */
async function fetchArticle(articleInfo) {
  console.log(`\nFetching: ${articleInfo.title.substring(0, 50)}...`);

  try {
    const response = await fetch(articleInfo.url);
    if (!response.ok) {
      console.warn(`  Failed to fetch article: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title (prioritize page title over passed-in title)
    const title = $('h1.entry-title, h1.post-title, article h1, .entry-header h1')
      .first().text().trim() || articleInfo.title;

    // Extract date
    let date = articleInfo.dateText;
    const dateEl = $('time[datetime], .posted-on time, .entry-date, .post-date').first();
    if (dateEl.length) {
      date = dateEl.attr('datetime') || dateEl.text().trim();
    }

    // Parse date to ISO format
    let isoDate;
    try {
      // Try to extract from URL first (most reliable)
      const urlDateMatch = articleInfo.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (urlDateMatch) {
        isoDate = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
      } else {
        isoDate = new Date(date).toISOString().split('T')[0];
      }
    } catch {
      isoDate = new Date().toISOString().split('T')[0];
    }

    // Extract main content
    const contentEl = $('article .entry-content, .post-content, article .content, .entry-content, main article').first();

    if (!contentEl.length) {
      console.warn('  Could not find article content');
      return null;
    }

    // Remove unwanted elements from content
    contentEl.find('nav, .navigation, .comments, .share, .related, .sidebar, script, style').remove();

    // Generate slug
    const slug = slugify(title);

    // Process images in content
    const images = [];
    let imageIndex = 0;

    for (const img of contentEl.find('img').toArray()) {
      const $img = $(img);
      const src = $img.attr('src');
      if (src) {
        const localPath = await downloadImage(src, slug, imageIndex++);
        images.push({ original: src, local: localPath });
        $img.attr('src', localPath);
      }
    }

    // Handle thumbnail
    let thumbnail = articleInfo.thumbnail;
    const featuredImg = $('article img, .post-thumbnail img, .entry-thumbnail img').first().attr('src');
    if (featuredImg && !thumbnail) {
      thumbnail = featuredImg;
    }
    if (thumbnail) {
      thumbnail = await downloadImage(thumbnail, slug, 'thumb');
    }

    // Convert to Markdown and clean up WordPress junk
    const contentHtml = contentEl.html();
    const markdown = cleanMarkdown(turndown.turndown(contentHtml));

    // Extract description (first paragraph or meta description)
    const metaDesc = $('meta[name="description"]').attr('content');
    const firstPara = contentEl.find('p').first().text().trim();
    const description = (metaDesc || firstPara || '').substring(0, 200);

    // Extract category from URL
    const category = extractCategory(articleInfo.url);

    return {
      slug,
      title,
      description,
      url: articleInfo.url,
      date: isoDate,
      thumbnail,
      category,
      markdown,
      images,
    };
  } catch (error) {
    console.error(`  Error processing article: ${error.message}`);
    return null;
  }
}

/**
 * Save article as markdown file
 */
async function saveArticle(article) {
  const frontmatter = `---
title: "${article.title.replace(/"/g, '\\"')}"
date: "${article.date}"
url: "${article.url}"
category: "${article.category}"
thumbnail: "${article.thumbnail || ''}"
description: "${article.description.replace(/"/g, '\\"')}"
---

`;

  const content = frontmatter + article.markdown;
  const filePath = path.join(ARTICLES_DIR, `${article.slug}.md`);

  await writeFile(filePath, content, 'utf-8');
  console.log(`  Saved: ${article.slug}.md`);

  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    url: article.url,
    date: article.date,
    thumbnail: article.thumbnail,
    category: article.category,
    markdownFile: `/news/articles/${article.slug}.md`,
  };
}

/**
 * Main scraping function
 */
async function main() {
  console.log('=== PRL News Scraper ===\n');

  // Ensure output directories exist
  await mkdir(ARTICLES_DIR, { recursive: true });
  await mkdir(IMAGES_DIR, { recursive: true });

  // Fetch article list
  const articleList = await fetchArticleList();

  if (articleList.length === 0) {
    console.error('No articles found!');
    process.exit(1);
  }

  // Fetch and process each article
  const processedArticles = [];

  for (const articleInfo of articleList) {
    const article = await fetchArticle(articleInfo);

    if (article) {
      const indexEntry = await saveArticle(article);
      processedArticles.push(indexEntry);
    }

    // Small delay to be respectful to the server
    await new Promise(r => setTimeout(r, 500));
  }

  // Sort by date (newest first)
  processedArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate index.json
  const index = {
    lastUpdated: new Date().toISOString(),
    articles: processedArticles,
  };

  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Processed ${processedArticles.length} articles`);
  console.log(`Index saved to: ${indexPath}`);
}

// Run the scraper
main().catch((error) => {
  console.error('Scraper failed:', error);
  process.exit(1);
});

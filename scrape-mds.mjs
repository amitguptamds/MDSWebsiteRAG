#!/usr/bin/env node
/**
 * MetaDesign Solutions Website Scraper
 * Parses all sitemaps and fetches content from every page,
 * then stores it as a structured JSON file.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';

const BASE_URL = 'https://metadesignsolutions.com';
const OUTPUT_FILE = './metadesign_solutions_website_data.json';
const PROGRESS_FILE = './scrape_progress.json';
const DELAY_MS = 1500; // polite delay between requests
const MAX_RETRIES = 3;

// Sitemap index URLs
const SITEMAP_URLS = [
  `${BASE_URL}/page-sitemap.xml`,
  `${BASE_URL}/post-sitemap.xml`,
  `${BASE_URL}/industries-sitemap.xml`,
  `${BASE_URL}/case-study-sitemap.xml`,
  `${BASE_URL}/technology-sitemap.xml`,
  `${BASE_URL}/technology-new-sitemap.xml`,
  `${BASE_URL}/white-paper-sitemap.xml`,
  `${BASE_URL}/news-sitemap.xml`,
];

// URLs to skip (non-content pages)
const SKIP_PATTERNS = [
  /\/wp-admin/,
  /\/wp-login/,
  /\/feed\//,
  /\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i,
  /\/cart\//,
  /\/checkout\//,
  /\/my-account\//,
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract URLs from XML sitemap content
 */
function extractUrlsFromSitemap(xmlContent) {
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1].trim();
    // Only include URLs from metadesignsolutions.com (skip image URLs etc.)
    if (url.startsWith(BASE_URL) && !url.endsWith('.xml')) {
      urls.push(url);
    }
  }
  return [...new Set(urls)]; // deduplicate
}

/**
 * Fetch with retries
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) {
        return await response.text();
      }
      console.warn(`  ⚠️ HTTP ${response.status} for ${url} (attempt ${i + 1}/${retries})`);
    } catch (error) {
      console.warn(`  ⚠️ Error fetching ${url} (attempt ${i + 1}/${retries}): ${error.message}`);
    }
    if (i < retries - 1) await sleep(2000);
  }
  return null;
}

/**
 * Strip HTML tags and clean up text content
 */
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|section|article|header|footer|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Extract meta description from HTML
 */
function extractMeta(html, name) {
  const regex = new RegExp(`<meta\\s+(?:name|property)=["'](?:og:)?${name}["']\\s+content=["'](.*?)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1].trim();
  // Try reverse attribute order
  const regex2 = new RegExp(`<meta\\s+content=["'](.*?)["']\\s+(?:name|property)=["'](?:og:)?${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1].trim() : '';
}

/**
 * Extract the page title
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/si);
  return titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
}

/**
 * Extract main content from HTML (try to get the main content area)
 */
function extractMainContent(html) {
  // Try to find main content containers
  const contentSelectors = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*(?:entry-content|post-content|page-content|content-area|main-content|site-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:content|main|primary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const regex of contentSelectors) {
    const match = html.match(regex);
    if (match && match[1] && match[1].length > 200) {
      return stripHtml(match[1]);
    }
  }
  
  // Fallback: remove header and footer, then strip
  let content = html;
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  return stripHtml(content);
}

/**
 * Extract headings from HTML
 */
function extractHeadings(html) {
  const headings = [];
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1].charAt(1));
    const text = stripHtml(match[2]).trim();
    if (text && text.length > 0 && text.length < 500) {
      headings.push({ level, text });
    }
  }
  return headings;
}

/**
 * Categorize URL by type
 */
function categorizeUrl(url) {
  if (url.includes('/case-study/')) return 'case_study';
  if (url.includes('/industries/')) return 'industry';
  if (url.includes('/technology/')) return 'technology';
  if (url.includes('/white-paper/')) return 'white_paper';
  if (url.includes('/news/')) return 'news';
  // Check for blog posts (posts at root level with long slugs)
  if (url.match(/metadesignsolutions\.com\/[a-z0-9-]{20,}\/?$/)) return 'blog_post';
  // Core pages
  const corePages = [
    'about', 'services', 'contact', 'career', 'team', 'portfolio',
    'expertise', 'innovation', 'partnership', 'engagement-model',
    'cloud', 'devops', 'testing', 'qa', 'digital', 'mobile', 'web',
    'ai', 'ml', 'gen-ai', 'automation', 'enterprise',
  ];
  const slug = url.replace(BASE_URL, '').replace(/\//g, '').toLowerCase();
  if (corePages.some(p => slug.includes(p))) return 'service_page';
  if (url === BASE_URL + '/' || url === BASE_URL) return 'homepage';
  return 'page';
}

/**
 * Load progress from previous run
 */
function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch {
      return { completed: [], data: [] };
    }
  }
  return { completed: [], data: [] };
}

/**
 * Save progress
 */
function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Main scraping function
 */
async function main() {
  console.log('🚀 Starting MetaDesign Solutions website scrape...\n');
  
  // Step 1: Collect all URLs from sitemaps
  console.log('📋 Fetching sitemaps...');
  const allUrls = new Set();
  
  for (const sitemapUrl of SITEMAP_URLS) {
    console.log(`  Fetching: ${sitemapUrl}`);
    const xml = await fetchWithRetry(sitemapUrl);
    if (xml) {
      const urls = extractUrlsFromSitemap(xml);
      urls.forEach(u => allUrls.add(u));
      console.log(`  Found ${urls.length} URLs`);
    } else {
      console.warn(`  ❌ Failed to fetch sitemap: ${sitemapUrl}`);
    }
    await sleep(500);
  }
  
  // Filter out unwanted URLs
  const filteredUrls = [...allUrls].filter(url => {
    return !SKIP_PATTERNS.some(pattern => pattern.test(url));
  });
  
  console.log(`\n📊 Total unique URLs to scrape: ${filteredUrls.length}\n`);
  
  // Step 2: Load progress
  const progress = loadProgress();
  const completedSet = new Set(progress.completed);
  const results = progress.data;
  
  const remaining = filteredUrls.filter(url => !completedSet.has(url));
  console.log(`📦 Already scraped: ${completedSet.size}, Remaining: ${remaining.length}\n`);
  
  // Step 3: Scrape each page
  let count = completedSet.size;
  const total = filteredUrls.length;
  
  for (const url of remaining) {
    count++;
    console.log(`[${count}/${total}] Scraping: ${url}`);
    
    const html = await fetchWithRetry(url);
    if (!html) {
      console.warn(`  ❌ Failed to fetch, skipping`);
      progress.completed.push(url);
      saveProgress(progress);
      continue;
    }
    
    const title = extractTitle(html);
    const description = extractMeta(html, 'description');
    const ogTitle = extractMeta(html, 'title');
    const ogImage = extractMeta(html, 'image');
    const content = extractMainContent(html);
    const headings = extractHeadings(html);
    const category = categorizeUrl(url);
    
    // Extract slug/path
    const path = new URL(url).pathname;
    
    const pageData = {
      url,
      path,
      category,
      title: title || ogTitle || '',
      description,
      og_image: ogImage,
      headings: headings.slice(0, 30), // limit headings
      content: content.substring(0, 15000), // limit content length
      content_length: content.length,
      scraped_at: new Date().toISOString(),
    };
    
    results.push(pageData);
    progress.completed.push(url);
    progress.data = results;
    
    // Save progress every 5 pages
    if (count % 5 === 0) {
      saveProgress(progress);
      console.log(`  💾 Progress saved (${count}/${total})`);
    }
    
    await sleep(DELAY_MS);
  }
  
  // Save final results
  saveProgress(progress);
  
  // Step 4: Organize and save final JSON
  console.log('\n📦 Organizing data...');
  
  const organizedData = {
    metadata: {
      website: BASE_URL,
      company_name: 'MetaDesign Solutions',
      scraped_at: new Date().toISOString(),
      total_pages: results.length,
      categories: {},
    },
    pages: results.sort((a, b) => {
      const categoryOrder = ['homepage', 'service_page', 'page', 'industry', 'technology', 'case_study', 'blog_post', 'white_paper', 'news'];
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    }),
  };
  
  // Count by category
  const categoryCounts = {};
  for (const page of results) {
    categoryCounts[page.category] = (categoryCounts[page.category] || 0) + 1;
  }
  organizedData.metadata.categories = categoryCounts;
  
  writeFileSync(OUTPUT_FILE, JSON.stringify(organizedData, null, 2));
  console.log(`\n✅ Done! Saved ${results.length} pages to ${OUTPUT_FILE}`);
  console.log('📊 Category breakdown:', categoryCounts);
}

main().catch(console.error);

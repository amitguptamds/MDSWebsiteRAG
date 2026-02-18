#!/usr/bin/env node
/**
 * MetaDesign Solutions Website Scraper - FAST VERSION
 * Uses concurrent requests (5 at a time) to speed up scraping.
 * Resumes from progress file.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';

const BASE_URL = 'https://metadesignsolutions.com';
const OUTPUT_FILE = './metadesign_solutions_website_data.json';
const PROGRESS_FILE = './scrape_progress.json';
const CONCURRENCY = 15; // concurrent requests
const DELAY_BETWEEN_BATCHES = 500; // ms between batches
const MAX_RETRIES = 2;

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

const SKIP_PATTERNS = [
    /\/wp-admin/, /\/wp-login/, /\/feed\//,
    /\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i,
    /\/cart\//, /\/checkout\//, /\/my-account\//,
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractUrlsFromSitemap(xmlContent) {
    const urls = [];
    const re = /<loc>(.*?)<\/loc>/g;
    let m;
    while ((m = re.exec(xmlContent))) {
        const url = m[1].trim();
        if (url.startsWith(BASE_URL) && !url.endsWith('.xml')) urls.push(url);
    }
    return [...new Set(urls)];
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const r = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                signal: AbortSignal.timeout(20000),
            });
            if (r.ok) return await r.text();
        } catch (_) { }
        if (i < retries - 1) await sleep(1000);
    }
    return null;
}

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
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
        .replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/\t/g, ' ').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
        .split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
}

function extractMeta(html, name) {
    const r1 = new RegExp(`<meta\\s+(?:name|property)=["'](?:og:)?${name}["']\\s+content=["'](.*?)["']`, 'i');
    const m1 = html.match(r1);
    if (m1) return m1[1].trim();
    const r2 = new RegExp(`<meta\\s+content=["'](.*?)["']\\s+(?:name|property)=["'](?:og:)?${name}["']`, 'i');
    const m2 = html.match(r2);
    return m2 ? m2[1].trim() : '';
}

function extractTitle(html) {
    const m = html.match(/<title[^>]*>(.*?)<\/title>/si);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMainContent(html) {
    const selectors = [
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<div[^>]*class="[^"]*(?:entry-content|post-content|page-content|content-area|main-content|site-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    for (const re of selectors) {
        const m = html.match(re);
        if (m && m[1] && m[1].length > 200) return stripHtml(m[1]);
    }
    let c = html;
    c = c.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    c = c.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    c = c.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    c = c.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
    return stripHtml(c);
}

function extractHeadings(html) {
    const headings = [];
    const re = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = re.exec(html))) {
        const text = stripHtml(m[2]).trim();
        if (text && text.length > 0 && text.length < 500)
            headings.push({ level: parseInt(m[1][1]), text });
    }
    return headings;
}

function categorizeUrl(url) {
    if (url.includes('/case-study/')) return 'case_study';
    if (url.includes('/industries/')) return 'industry';
    if (url.includes('/technology/')) return 'technology';
    if (url.includes('/white-paper/')) return 'white_paper';
    if (url.includes('/news/')) return 'news';
    if (url.match(/metadesignsolutions\.com\/[a-z0-9-]{20,}\/?$/)) return 'blog_post';
    if (url === BASE_URL + '/' || url === BASE_URL) return 'homepage';
    return 'page';
}

function loadProgress() {
    if (existsSync(PROGRESS_FILE)) {
        try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')); }
        catch { return { completed: [], data: [] }; }
    }
    return { completed: [], data: [] };
}

function saveProgress(progress) {
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

async function scrapePage(url) {
    const html = await fetchWithRetry(url);
    if (!html) return null;

    const content = extractMainContent(html);
    return {
        url,
        path: new URL(url).pathname,
        category: categorizeUrl(url),
        title: extractTitle(html) || extractMeta(html, 'title') || '',
        description: extractMeta(html, 'description'),
        og_image: extractMeta(html, 'image'),
        headings: extractHeadings(html).slice(0, 30),
        content: content.substring(0, 15000),
        content_length: content.length,
        scraped_at: new Date().toISOString(),
    };
}

async function main() {
    console.log('🚀 Starting MetaDesign Solutions website scrape (FAST mode)...\n');

    // Step 1: Collect all URLs from sitemaps
    console.log('📋 Fetching sitemaps...');
    const allUrls = new Set();

    for (const sitemapUrl of SITEMAP_URLS) {
        const xml = await fetchWithRetry(sitemapUrl);
        if (xml) {
            const urls = extractUrlsFromSitemap(xml);
            urls.forEach(u => allUrls.add(u));
            console.log(`  ${sitemapUrl.split('/').pop()}: ${urls.length} URLs`);
        }
        await sleep(200);
    }

    const filteredUrls = [...allUrls].filter(url =>
        !SKIP_PATTERNS.some(p => p.test(url))
    );

    console.log(`\n📊 Total unique URLs: ${filteredUrls.length}\n`);

    // Step 2: Load progress
    const progress = loadProgress();
    const completedSet = new Set(progress.completed);
    const results = progress.data;
    const remaining = filteredUrls.filter(url => !completedSet.has(url));

    console.log(`📦 Already scraped: ${completedSet.size}, Remaining: ${remaining.length}\n`);

    // Step 3: Scrape in batches
    let done = completedSet.size;
    const total = filteredUrls.length;

    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
        const batch = remaining.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(url => scrapePage(url)));

        for (let j = 0; j < batch.length; j++) {
            done++;
            if (batchResults[j]) {
                results.push(batchResults[j]);
            }
            progress.completed.push(batch[j]);
        }

        progress.data = results;
        saveProgress(progress);

        const pct = ((done / total) * 100).toFixed(1);
        console.log(`  [${done}/${total}] (${pct}%) - Batch of ${batch.length} complete`);

        if (i + CONCURRENCY < remaining.length) await sleep(DELAY_BETWEEN_BATCHES);
    }

    // Step 4: Save final JSON
    console.log('\n📦 Organizing final data...');

    const categoryOrder = ['homepage', 'service_page', 'page', 'industry', 'technology', 'case_study', 'blog_post', 'white_paper', 'news'];
    const organizedData = {
        metadata: {
            website: BASE_URL,
            company_name: 'MetaDesign Solutions',
            scraped_at: new Date().toISOString(),
            total_pages: results.length,
            categories: {},
        },
        pages: results.sort((a, b) =>
            categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
        ),
    };

    const cats = {};
    for (const p of results) cats[p.category] = (cats[p.category] || 0) + 1;
    organizedData.metadata.categories = cats;

    writeFileSync(OUTPUT_FILE, JSON.stringify(organizedData, null, 2));
    console.log(`\n✅ Done! Saved ${results.length} pages to ${OUTPUT_FILE}`);
    console.log('📊 Categories:', cats);
}

main().catch(console.error);

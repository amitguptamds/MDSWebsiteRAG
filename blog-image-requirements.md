# MetaDesign Solutions — Blog Image Requirements

> Reference document for automating blog creation, image generation, and upload to the MDS WordPress website.

---

## Quick Reference Table

| # | Image Type | Dimensions (px) | Format | Required? | Where Used |
|---|---|---|---|---|---|
| 1 | **Featured Image (og:image)** | **1100 × 720** | JPG / PNG | ✅ Yes | Social sharing, WordPress featured image, SEO meta tags |
| 2 | **Blog Card Thumbnail** | **370 × 206** (natural: 300 × 167) | PNG / JPG | ✅ Yes | Blog listing page grid cards |
| 3 | **Hero/Banner Background** | **1470 × 560** | PNG / WebP | ❌ Optional | Blog listing page hero section (site-wide, not per-post) |
| 4 | **Author Avatar** | **96 × 96** (rendered: 50 × 50) | JPG / PNG | ✅ Yes | Left sidebar of every blog post |
| 5 | **In-Content Image** | **900–1000 × auto** | PNG / JPG / WebP | ❌ Optional | Within blog post body (diagrams, charts, illustrations) |
| 6 | **CTA Banner Image** | **800 × 400** (approx.) | PNG / JPG | ❌ Optional | Mid-article or end-of-article call-to-action blocks |

---

## Detailed Image Specifications

### 1. Featured Image / OG Image (Social Sharing)
- **Dimensions:** 1100 × 720 pixels
- **Aspect Ratio:** ~1.53:1 (landscape)
- **Format:** JPG or PNG
- **File Size Target:** < 300 KB (optimised)
- **Used by:**
  - `og:image` meta tag (Facebook, LinkedIn shares)
  - `og:image:width` = 1100, `og:image:height` = 720
  - `twitter:image` meta tag
  - WordPress "Featured Image" field
- **Current default:** `https://metadesignsolutions.com/wp-content/uploads/2024/12/flutter.jpg`
- **Design Notes:** Should represent the blog topic visually. Include blog title overlay text or thematic illustration. Must look professional when shared on social media.

### 2. Blog Card Thumbnail
- **Natural Dimensions:** ~300 × 167 pixels
- **Rendered on Page:** ~370 × 206 pixels (CSS-scaled)
- **Aspect Ratio:** ~1.79:1 (close to 16:9)
- **Format:** PNG or JPG
- **CSS Class:** `elementor-post__thumbnail`, `attachment-medium`
- **Used by:** Blog listing page cards under "OTHER INSIGHTS" section
- **Design Notes:** 
  - Most cards on the listing page currently display **without** thumbnails (text-only cards with grey backgrounds)
  - When thumbnails are enabled, they appear as rectangular images above the card text
  - Generate at **400 × 225** to allow quality rendering at the displayed size

### 3. Hero / Banner Background
- **Dimensions:** 1470 × 560 pixels
- **Format:** PNG / WebP
- **Current banner:** `/wp-content/uploads/2024/06/career-banner.png`
- **Usage:** Full-width background behind the blog listing page header area
- **Design Notes:** This is a **site-level** banner, NOT per-blog-post. Only needed if creating new blog category pages or updating the listing hero.

### 4. Author Avatar
- **Natural Size:** 96 × 96 pixels
- **Rendered Size:** 50 × 50 pixels (circular crop via CSS)
- **Format:** JPG or PNG
- **CSS Class:** `author-image`
- **Source Path:** Served from LiteSpeed cache: `/wp-content/litespeed/avatar/`
- **Used by:** Left sidebar on every blog post page — shows next to the author name, reading time, and publish date
- **Design Notes:** Upload square images. The site applies `border-radius: 50%` for circular display.

### 5. In-Content Images
- **Width:** 900–1000 px (fits within the content column max-width)
- **Height:** Auto / proportional
- **Format:** PNG, JPG, or WebP
- **Used by:** Body of blog post — diagrams, code screenshots, infographics, comparison charts
- **Design Notes:** 
  - The content area has a max width of ~830px on desktop
  - Generate images at 1000px width for retina/high-DPI clarity
  - Use descriptive alt text for SEO
  - Compress to < 200 KB per image

### 6. CTA Banner Image (Optional)
- **Approximate Size:** 800 × 400 px
- **Format:** PNG / JPG
- **Used by:** Mid-article or end-of-article call-to-action blocks (e.g., "Inquire Now", "Get a Free Consultation")
- **Design Notes:** Current blog posts use text-based CTAs styled with Elementor, but custom CTA banners can be added for visual impact.

---

## WordPress Upload Conventions

| Property | Value |
|---|---|
| **Upload Base URL** | `https://metadesignsolutions.com/wp-content/uploads/` |
| **Directory Structure** | `YYYY/MM/filename.extension` (e.g., `2025/04/parental-control-featured.png`) |
| **Naming Convention** | Lowercase, hyphens between words (e.g., `vibe-coding-featured.png`) |
| **WordPress Generates** | Multiple sizes: thumbnail (150×150), medium (300×300), large (1024×1024), full |

---

## Blog Page Layout & Image Placements

### Blog Listing Page (`/blogs/`)
```
┌──────────────────────────────────────────┐
│  HEADER (Logo + Navigation)              │
├──────────────────────────────────────────┤
│  HERO BANNER (1470 × 560 background)     │
│  "Blogs — Explore Insights..."           │
├──────────────────────────────────────────┤
│  FEATURED INSIGHTS (2 cards)             │
│  ┌─────────────┐  ┌─────────────┐        │
│  │ [Thumbnail]  │  │ [Thumbnail]  │       │
│  │  Title       │  │  Title       │       │
│  │  Author      │  │  Author      │       │
│  └─────────────┘  └─────────────┘        │
├──────────────────────────────────────────┤
│  OTHER INSIGHTS (Grid of cards)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Title    │ │ Title    │ │ Title    │  │
│  │ Author   │ │ Author   │ │ Author   │  │
│  │ Excerpt  │ │ Excerpt  │ │ Excerpt  │  │
│  └──────────┘ └──────────┘ └──────────┘  │
│  [Load More]                             │
└──────────────────────────────────────────┘
```

### Individual Blog Post Page
```
┌──────────────────────────────────────────┐
│  HEADER (Logo + Navigation)              │
├──────────────────────────────────────────┤
│  BLOG TITLE (H1, full-width)             │
├──────────┬───────────────────────────────┤
│ SIDEBAR  │  ARTICLE CONTENT              │
│          │                               │
│ [Avatar] │  Intro paragraph...           │
│ Author   │                               │
│ 6 min    │  ## Heading 2                 │
│ Category │  Content with [In-Content     │
│ Date     │   Images] as needed...        │
│          │                               │
│ NEWSLETTER│  [CTA Banner] — Inquire Now  │
│  Form    │                               │
│          │  ## More content...            │
│ BUILD YOUR│                              │
│ AGILE    │  ### Conclusion               │
│ TEAM     │                               │
│ Lead Form│  Related Hashtags             │
│          │  Blog Rating Widget           │
├──────────┴───────────────────────────────┤
│  SOCIAL SHARING ICONS (Fixed right side) │
│  Facebook | X | Email | LinkedIn | WhatsApp│
└──────────────────────────────────────────┘
```

---

## Image Checklist for Blog Automation

When creating a new blog post, generate the following images:

- [ ] **Featured Image** (1100 × 720) — Topic-themed, SEO-optimised
- [ ] **Author Avatar** (96 × 96) — Only needed once per new author
- [ ] **In-Content Diagrams** (1000 × auto) — If the blog has technical diagrams, comparison tables, or process flows
- [ ] **WordPress Upload** — Upload to `/wp-content/uploads/YYYY/MM/`

### Image Generation Prompts (for AI tools)

**Featured Image Template:**
> "Professional blog featured image for a tech company article titled '[BLOG TITLE]'. Modern, clean design with abstract tech elements in dark red (#8B1A1A) and dark grey (#2D2D2D) color scheme matching MetaDesign Solutions brand. 1100x720 pixels, high quality."

**In-Content Diagram Template:**
> "Clean, professional infographic/diagram illustrating [TOPIC]. White background, minimal design using red (#8B1A1A) and dark grey (#333333) accents. 1000px wide, business-appropriate."

---

## Technical Notes for Automation

1. **WordPress REST API** endpoint for media upload: `POST /wp-json/wp/v2/media`
2. **Set Featured Image:** After upload, set the `featured_media` field on the post with the media ID
3. **Meta Tags:** WordPress + Yoast SEO will auto-generate `og:image` from the featured image
4. **Image Optimization:** Use WebP format where possible; WordPress may auto-convert via LiteSpeed Cache plugin
5. **Alt Text:** Always set meaningful alt text for accessibility and SEO
6. **File Naming:** Use slugified blog title as image name (e.g., `what-is-vibe-coding-featured.jpg`)

---

*Document generated: 2026-02-20 | Based on live analysis of https://metadesignsolutions.com/blogs/*

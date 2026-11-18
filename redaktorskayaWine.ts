import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { loadCheerio } from '@libs/cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

const SITE = 'https://read.redaktorskaya.date';
const INDEX = `${SITE}/contents/wine/`;

class RedaktorskayaWine implements Plugin.PluginBase {
  id = 'redaktorskayaWine';
  name = 'Redaktorskaya — Поднося вино';
  icon = 'src/ru/redaktorskayaWine/icon.png';
  site = SITE;
  version = '0.1.0';

  resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, SITE).toString();
  }

  private async getHtml(url: string): Promise<string> {
    const response = await fetchApi(url, {
      headers: {
        Referer: INDEX,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      },
    });
    return response.text();
  }

  private async getBook(): Promise<Plugin.NovelItem[]> {
    const html = await this.getHtml(INDEX);
    const $ = loadCheerio(html);
    const cover = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || $('img').first().attr('src');
    return [{
      name: 'Поднося вино',
      path: INDEX,
      cover: cover ? new URL(cover, INDEX).toString() : defaultCover,
    }];
  }

  async popularNovels(_pageNo: number): Promise<Plugin.NovelItem[]> {
    return this.getBook();
  }

  async searchNovels(searchTerm: string, _pageNo: number): Promise<Plugin.NovelItem[]> {
    const normalized = searchTerm.toLocaleLowerCase();
    if (!normalized || 'поднося вино 将进酒 тан цзюин redaktorskaya'.includes(normalized)
      || normalized.includes('поднося') || normalized.includes('вино')) {
      return this.getBook();
    }
    return [];
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const html = await this.getHtml(novelPath || INDEX);
    const $ = loadCheerio(html);
    const cover = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || $('img').first().attr('src');

    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();
    const chapterLinks = $('a[href*="/read/"]');
    chapterLinks.each((index, element) => {
      const link = $(element);
      const href = link.attr('href');
      const name = link.text().replace(/\s+/g, ' ').trim();
      if (!href || !name || seen.has(href)) return;
      seen.add(href);
      const numberMatch = name.match(/Глава\s*(\d+(?:\.\d+)?)/i);
      chapters.push({
        name,
        path: new URL(href, INDEX).toString(),
        chapterNumber: numberMatch ? Number(numberMatch[1]) : index,
        releaseTime: '',
      });
    });

    // Keep the source's displayed reading order, including glossary/extra chapters.
    return {
      path: novelPath || INDEX,
      name: $('h1').first().text().trim() || 'Поднося вино',
      cover: cover ? new URL(cover, INDEX).toString() : defaultCover,
      author: 'Тан Цзюин',
      artist: '',
      genres: 'Данмэй, Историческое, Романтика',
      status: NovelStatus.Completed,
      summary: $('meta[name="description"]').attr('content') || 'Русский перевод романа «Поднося вино» (将进酒). Перевод канала BLPlace.',
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const html = await this.getHtml(this.resolveUrl(chapterPath));
    const $ = loadCheerio(html);
    $('script, style, nav, header, footer, .navigation, .chapter-navigation, .share, .comments').remove();

    const candidates = [
      'article', 'main', '.entry-content', '.post-content', '.content',
      '.reader-content', '.chapter-content', '[itemprop="articleBody"]',
    ];
    let content = '';
    for (const selector of candidates) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > content.length) {
        content = element.html() || '';
      }
    }
    if (!content) content = $('body').html() || '';
    if (!content.trim()) throw new Error('Не удалось найти текст главы на странице сайта.');
    return content;
  }
}

export default new RedaktorskayaWine();

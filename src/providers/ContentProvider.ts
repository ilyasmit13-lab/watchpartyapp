export type ContentProviderType = 'youtube' | 'tiktok' | 'direct' | 'local';

export interface ContentMetadata {
  id: string;
  provider: ContentProviderType;
  title: string;
  thumbnailUrl?: string;
  durationSec?: number;
  mimeType?: string; // For direct links
  extra?: Record<string, any>;
}

export interface PlayerSource {
  uri: string;
  type?: string;
  headers?: Record<string, string>;
  isEmbed: boolean;
  embedHtml?: string;
}

export interface ContentProvider {
    /**
     * Unique identifier for the provider (e.g. 'youtube')
     */
    name: ContentProviderType;

    /**
     * Regex to match compatible URLs
     */
    urlPatterns: RegExp[];

    /**
     * Parse a URL and return a normalized ID and provider type
     */
    parseUrl(url: string): { id: string; provider: ContentProviderType } | null;

    /**
     * Fetch metadata for the content (title, duration, etc.)
     */
    fetchMetadata(id: string): Promise<ContentMetadata>;

    /**
     * Get the source object for playback (URL or Embed config)
     */
    getPlayableSource(id: string): Promise<PlayerSource>;
}

// Registry to manage providers
class ProviderRegistry {
    private providers: Record<string, ContentProvider> = {};

    register(provider: ContentProvider) {
        this.providers[provider.name] = provider;
    }

    get(name: string): ContentProvider | undefined {
        return this.providers[name];
    }

    /**
     * Find a provider that matches the given URL
     */
    matchUrl(url: string): ContentProvider | undefined {
        return Object.values(this.providers).find(p => 
            p.urlPatterns.some(pattern => pattern.test(url))
        );
    }
}

export const contentProviders = new ProviderRegistry();

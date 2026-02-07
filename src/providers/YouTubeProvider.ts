import { ContentProvider, ContentMetadata, PlayerSource, contentProviders } from './ContentProvider';

export class YouTubeProvider implements ContentProvider {
    name = 'youtube' as const;

    // Regex for standard, short, and embed URLs
    urlPatterns = [
        /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
        /^(https?:\/\/)?(www\.|m\.|music\.)?youtube\.com\/embed\/([\w-]{11})/
    ];

    parseUrl(url: string) {
        // Try all patterns
        for (const pattern of this.urlPatterns) {
            const match = url.match(pattern);
            if (match) {
                // The ID is usually the last capturing group for these regexes
                // Standard: group 4
                // Short: group 4 (via | logic)
                // Embed: group 3
                const id = match[match.length - 1];
                return { id, provider: this.name };
            }
        }
        return null;
    }

    async fetchMetadata(id: string): Promise<ContentMetadata> {
        // In a real app, call YouTube Data API here.
        // For now, return mock data or oEmbed data.
        return {
            id,
            provider: this.name,
            title: `YouTube Video (${id})`,
            thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        };
    }

    async getPlayableSource(id: string): Promise<PlayerSource> {
        return {
            uri: `https://www.youtube.com/embed/${id}?playsinline=1&controls=0&enablejsapi=1`,
            isEmbed: true,
        };
    }
}

// Register singleton
const ytProvider = new YouTubeProvider();
contentProviders.register(ytProvider);
export { ytProvider };

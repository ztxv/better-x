import { describe, expect, it } from 'vitest';
import {
  gifVideoUrl,
  isDownloadableUrl,
  isMediaKey,
  mediaKey,
  originalPhotoUrl,
  safeVideoUrl,
} from './urls';

describe('photo originals', () => {
  it('requests name=orig and keeps the served format', () => {
    expect(originalPhotoUrl('https://pbs.twimg.com/media/AbC_1-2?format=png&name=small')).toBe(
      'https://pbs.twimg.com/media/AbC_1-2?format=png&name=orig',
    );
    expect(originalPhotoUrl('https://pbs.twimg.com/media/BhxWutnCEAAtEQ6.jpg')).toBe(
      'https://pbs.twimg.com/media/BhxWutnCEAAtEQ6?format=jpg&name=orig',
    );
  });
  it('never rewrites avatars, cards, video posters, or other hosts', () => {
    for (const url of [
      'https://pbs.twimg.com/profile_images/1/a_normal.jpg',
      'https://pbs.twimg.com/card_img/1/x?format=jpg&name=small',
      'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/a.jpg',
      'https://pbs.twimg.com.evil.example/media/A?format=jpg',
      'http://pbs.twimg.com/media/A?format=jpg',
      'https://pbs.twimg.com/media/A?format=svg',
      'https://pbs.twimg.com/media/A',
    ])
      expect(originalPhotoUrl(url)).toBeNull();
  });
});

describe('video sources', () => {
  it('maps GIF previews to their MP4', () => {
    expect(gifVideoUrl('https://pbs.twimg.com/tweet_video_thumb/EC6DSXDXsAEhHAa.jpg')).toBe(
      'https://video.twimg.com/tweet_video/EC6DSXDXsAEhHAa.mp4',
    );
    expect(gifVideoUrl('https://pbs.twimg.com/media/EC6DSXDXsAEhHAa.jpg')).toBeNull();
  });
  it('accepts only direct MP4 files on the video CDN', () => {
    const mp4 =
      'https://video.twimg.com/ext_tw_video/1585341912877146112/pu/vid/480x270/6tarM2TjLH1Ahh90.mp4?tag=14';
    expect(safeVideoUrl(mp4)).toBe(mp4);
    expect(
      safeVideoUrl('https://video.twimg.com/amplify_video/1/vid/avc1/720x1280/a.mp4'),
    ).not.toBeNull();
    for (const url of [
      'blob:https://x.com/5f1c',
      'https://video.twimg.com/ext_tw_video/1/pu/pl/abc.m3u8?tag=14',
      'https://video.twimg.com/ext_tw_video/1/pu/vid/480x270/x.m3u8',
      'https://evil.example/tweet_video/a.mp4',
      'https://video.twimg.com/other/a.mp4',
      'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/a.jpg',
    ])
      expect(safeVideoUrl(url)).toBeNull();
  });
  it('lets only verified sources reach the downloader', () => {
    expect(isDownloadableUrl('https://video.twimg.com/tweet_video/A.mp4')).toBe(true);
    expect(isDownloadableUrl('https://pbs.twimg.com/media/A?format=jpg&name=orig')).toBe(true);
    expect(isDownloadableUrl('https://example.com/a.mp4')).toBe(false);
  });
});

describe('media keys', () => {
  it('match the same item across preview and source', () => {
    const photo = 'https://pbs.twimg.com/media/AbC?format=jpg&name=small';
    expect(mediaKey({ thumbnailUrl: photo }, 0)).toBe('img:AbC');
    expect(
      mediaKey(
        { thumbnailUrl: null, sourceUrl: 'https://pbs.twimg.com/media/AbC?format=jpg&name=orig' },
        2,
      ),
    ).toBe('img:AbC');
    expect(mediaKey({ thumbnailUrl: 'https://pbs.twimg.com/tweet_video_thumb/G1.jpg' }, 0)).toBe(
      'gif:G1',
    );
    expect(
      mediaKey({ thumbnailUrl: null, sourceUrl: 'https://video.twimg.com/tweet_video/G1.mp4' }, 0),
    ).toBe('gif:G1');
    expect(
      mediaKey({ thumbnailUrl: 'https://pbs.twimg.com/amplify_video_thumb/77/img/a.jpg' }, 0),
    ).toBe('vid:77');
    expect(
      mediaKey(
        {
          thumbnailUrl: null,
          sourceUrl: 'https://video.twimg.com/ext_tw_video/77/pu/vid/1x1/a.mp4',
        },
        0,
      ),
    ).toBe('vid:77');
    expect(mediaKey({ thumbnailUrl: null }, 3)).toBe('n:3');
  });
  it('validates keys at message boundaries', () => {
    expect(isMediaKey('img:AbC')).toBe(true);
    expect(isMediaKey('n:2')).toBe(true);
    expect(isMediaKey('n:9')).toBe(false);
    expect(isMediaKey('img:../x')).toBe(false);
    expect(isMediaKey('https://x')).toBe(false);
  });
});

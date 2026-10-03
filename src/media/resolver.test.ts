import { describe, expect, it } from 'vitest';
import type { PostMedia } from '../types/model';
import { fakeFetch, json, ok } from '../test/fakes';
import { resolveMedia } from './resolver';
import { parseSyndication, syndicationUrl } from './syndication';
import videoPost from './fixtures/syndication-video.json';
import photoPost from './fixtures/syndication-photo.json';

/** Recorded from the live endpoint on 2026-10-03 (trimmed to the fields that are read). */
const VIDEO_ID = '1585341984679469056';
const BEST_MP4 =
  'https://video.twimg.com/ext_tw_video/1585341912877146112/pu/vid/1920x1080/aeoVUvTgj4wHShhN.mp4?tag=14';
const VIDEO_THUMB =
  'https://pbs.twimg.com/ext_tw_video_thumb/1585341912877146112/pu/img/DwJ7wlGIe9iryk6N.jpg';

const media = (item: Partial<PostMedia> & Pick<PostMedia, 'kind'>): PostMedia => ({
  thumbnailUrl: null,
  sourceUrl: null,
  alt: null,
  ...item,
});

describe('post metadata adapter', () => {
  it('picks the highest-bitrate progressive MP4 and ignores the HLS playlist', () => {
    const result = parseSyndication(VIDEO_ID, videoPost);
    expect(result).toEqual({
      status: 'found',
      media: [
        {
          kind: 'video',
          key: 'vid:1585341912877146112',
          photoUrl: null,
          videoUrl: BEST_MP4,
          available: true,
        },
      ],
    });
  });
  it('treats tombstones, empty bodies, and mismatched posts as missing', () => {
    expect(parseSyndication(VIDEO_ID, {})).toEqual({ status: 'missing' });
    expect(parseSyndication(VIDEO_ID, { __typename: 'TweetTombstone' })).toEqual({
      status: 'missing',
    });
    expect(parseSyndication('1', videoPost)).toEqual({ status: 'missing' });
  });
  it('always sends a non-empty token', () => {
    expect(syndicationUrl(VIDEO_ID)).toMatch(
      /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=1585341984679469056&token=[a-z0-9]+&lang=en$/,
    );
  });
});

describe('resolving media', () => {
  it('downloads photos at original resolution with the served extension', async () => {
    const orig = 'https://pbs.twimg.com/media/AbC?format=png&name=orig';
    const { fetcher, calls } = fakeFetch({ [orig]: ok('image/png') });
    const result = await resolveMedia(
      {
        sourceTweetId: '1',
        index: 0,
        kind: 'image',
        key: 'img:AbC',
        item: media({
          kind: 'image',
          thumbnailUrl: 'https://pbs.twimg.com/media/AbC?format=png&name=small',
        }),
      },
      fetcher,
    );
    expect(result).toEqual({ status: 'available', url: orig, extension: 'png' });
    expect(calls).toEqual([{ url: orig, method: 'HEAD' }]);
  });

  it('keeps GIFs as MP4 files without asking for post metadata', async () => {
    const mp4 = 'https://video.twimg.com/tweet_video/G1.mp4';
    const { fetcher, calls } = fakeFetch({ [mp4]: ok('video/mp4') });
    const result = await resolveMedia(
      {
        sourceTweetId: '1',
        index: 0,
        kind: 'gif',
        key: 'gif:G1',
        item: media({
          kind: 'gif',
          thumbnailUrl: 'https://pbs.twimg.com/tweet_video_thumb/G1.jpg',
        }),
      },
      fetcher,
    );
    expect(result).toEqual({ status: 'available', url: mp4, extension: 'mp4' });
    expect(calls).toHaveLength(1);
  });

  it('resolves a regular video from post metadata, matched by media ID', async () => {
    const { fetcher } = fakeFetch({
      [syndicationUrl(VIDEO_ID)]: json(videoPost),
      [BEST_MP4]: ok('video/mp4'),
    });
    const result = await resolveMedia(
      {
        sourceTweetId: VIDEO_ID,
        index: 0,
        kind: 'video',
        key: 'vid:1585341912877146112',
        item: media({ kind: 'video', thumbnailUrl: VIDEO_THUMB }),
      },
      fetcher,
    );
    expect(result).toEqual({ status: 'available', url: BEST_MP4, extension: 'mp4' });
  });

  it('never saves a poster image as a video', async () => {
    const posterOnly = {
      ...videoPost,
      mediaDetails: [{ ...videoPost.mediaDetails[0], video_info: { variants: [] } }],
    };
    const { fetcher, calls } = fakeFetch({ [syndicationUrl(VIDEO_ID)]: json(posterOnly) });
    const result = await resolveMedia(
      {
        sourceTweetId: VIDEO_ID,
        index: 0,
        kind: 'video',
        key: 'vid:1585341912877146112',
        item: media({ kind: 'video', thumbnailUrl: VIDEO_THUMB }),
      },
      fetcher,
    );
    expect(result).toEqual({ status: 'unsupported' });
    expect(calls.some((call) => call.url.includes('pbs.twimg.com'))).toBe(false);
  });

  it('asks to open the post when metadata is unavailable (protected or deleted)', async () => {
    const { fetcher } = fakeFetch({
      [syndicationUrl(VIDEO_ID)]: () => new Response('<html>', { status: 404 }),
    });
    const result = await resolveMedia(
      { sourceTweetId: VIDEO_ID, index: 0, kind: 'video', key: 'n:0', item: null },
      fetcher,
    );
    expect(result).toEqual({ status: 'needsPost' });
  });

  it('reports offline as a network failure, not as missing media', async () => {
    const { fetcher } = fakeFetch({});
    expect(
      await resolveMedia(
        { sourceTweetId: VIDEO_ID, index: 0, kind: 'video', key: 'n:0', item: null },
        fetcher,
      ),
    ).toEqual({ status: 'network' });
    expect(
      await resolveMedia(
        {
          sourceTweetId: '1',
          index: 0,
          kind: 'image',
          key: 'img:A',
          item: media({
            kind: 'image',
            thumbnailUrl: 'https://pbs.twimg.com/media/A?format=jpg&name=small',
          }),
        },
        fetcher,
      ),
    ).toEqual({ status: 'network' });
  });

  it('reports removed files and withheld media as unavailable', async () => {
    const orig = 'https://pbs.twimg.com/media/Gone?format=jpg&name=orig';
    const { fetcher } = fakeFetch({ [orig]: () => new Response(null, { status: 404 }) });
    expect(
      await resolveMedia(
        {
          sourceTweetId: '1',
          index: 0,
          kind: 'image',
          key: 'img:Gone',
          item: media({
            kind: 'image',
            thumbnailUrl: 'https://pbs.twimg.com/media/Gone?format=jpg&name=small',
          }),
        },
        fetcher,
      ),
    ).toEqual({ status: 'unavailable' });
    const withheld = {
      ...videoPost,
      mediaDetails: [
        { ...videoPost.mediaDetails[0], ext_media_availability: { status: 'Unavailable' } },
      ],
    };
    const blocked = fakeFetch({ [syndicationUrl(VIDEO_ID)]: json(withheld) });
    expect(
      await resolveMedia(
        { sourceTweetId: VIDEO_ID, index: 0, kind: 'video', key: 'n:0', item: null },
        blocked.fetcher,
      ),
    ).toEqual({ status: 'unavailable' });
  });

  it('finds a photo with no saved preview through post metadata', async () => {
    const orig = 'https://pbs.twimg.com/media/BhxWutnCEAAtEQ6?format=jpg&name=orig';
    const { fetcher } = fakeFetch({
      [syndicationUrl('440322224407314432')]: json(photoPost),
      [orig]: ok('image/jpeg'),
    });
    expect(
      await resolveMedia(
        {
          sourceTweetId: '440322224407314432',
          index: 0,
          kind: 'image',
          key: 'n:0',
          item: media({ kind: 'image' }),
        },
        fetcher,
      ),
    ).toEqual({ status: 'available', url: orig, extension: 'jpg' });
  });
});

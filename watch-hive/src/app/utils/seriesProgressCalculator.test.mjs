import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    calculateSeriesProgress,
    calculateSeasonProgress,
    isSeriesCompletedByEpisodes,
} from './seriesProgressCalculator.js';

const past = '2020-01-01';
const future = '2099-01-01';

describe('calculateSeriesProgress (released-only, no specials)', () => {
    it('excludes specials from watched and total', () => {
        const progress = {
            seasons: {
                0: { episodes: [1, 2, 3] },
                1: { episodes: [1, 2] },
            },
        };
        const seasons = [
            { season_number: 0, episode_count: 3, air_date: past },
            {
                season_number: 1,
                episode_count: 2,
                air_date: past,
                episodes: [
                    { episode_number: 1, air_date: past },
                    { episode_number: 2, air_date: past },
                ],
            },
        ];
        const { watched, total, percentage } = calculateSeriesProgress(progress, seasons);
        assert.strictEqual(watched, 2);
        assert.strictEqual(total, 2);
        assert.strictEqual(percentage, 100);
    });

    it('does not count unreleased episodes in total', () => {
        const progress = {
            seasons: {
                1: { episodes: [1, 2] },
            },
        };
        const seasons = [
            {
                season_number: 1,
                episode_count: 5,
                air_date: past,
                episodes: [
                    { episode_number: 1, air_date: past },
                    { episode_number: 2, air_date: past },
                    { episode_number: 3, air_date: future },
                    { episode_number: 4, air_date: future },
                    { episode_number: 5, air_date: future },
                ],
            },
        ];
        const { watched, total, percentage } = calculateSeriesProgress(progress, seasons);
        assert.strictEqual(watched, 2);
        assert.strictEqual(total, 2);
        assert.strictEqual(percentage, 100);
    });

    it('stays below 100% when released episodes remain unwatched', () => {
        const progress = {
            seasons: {
                1: { episodes: [1] },
            },
        };
        const seasons = [
            {
                season_number: 1,
                episode_count: 4,
                air_date: past,
                episodes: [
                    { episode_number: 1, air_date: past },
                    { episode_number: 2, air_date: past },
                    { episode_number: 3, air_date: past },
                    { episode_number: 4, air_date: past },
                ],
            },
        ];
        const { percentage } = calculateSeriesProgress(progress, seasons);
        assert.strictEqual(percentage, 25);
    });

    it('isSeriesCompletedByEpisodes is true only at 100% released', () => {
        const progress = {
            seasons: {
                1: {
                    episodes: [1, 2],
                    completed: true,
                },
            },
        };
        const seasons = [
            {
                season_number: 1,
                episode_count: 2,
                air_date: past,
                episodes: [
                    { episode_number: 1, air_date: past },
                    { episode_number: 2, air_date: past },
                ],
            },
        ];
        assert.strictEqual(isSeriesCompletedByEpisodes(progress, seasons), true);
    });
});

describe('calculateSeasonProgress', () => {
    it('matches released-only season math', () => {
        const progress = { seasons: { 1: { episodes: [1, 2] } } };
        const seasonData = {
            season_number: 1,
            episode_count: 4,
            episodes: [
                { episode_number: 1, air_date: past },
                { episode_number: 2, air_date: past },
                { episode_number: 3, air_date: future },
                { episode_number: 4, air_date: future },
            ],
        };
        const { watched, total, percentage } = calculateSeasonProgress(1, progress, seasonData);
        assert.strictEqual(watched, 2);
        assert.strictEqual(total, 2);
        assert.strictEqual(percentage, 100);
    });
});

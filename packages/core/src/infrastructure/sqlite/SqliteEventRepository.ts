import { randomBytes } from 'node:crypto';
import type { TrackedEvent } from '../../domain/events/entities/TrackedEvent';
import type { EventRepository, SaltRepository } from '../../domain/events/repositories/EventRepository';
import type { Db } from './database';

export class SqliteEventRepository implements EventRepository {
  private readonly insertStmt;
  private readonly insertAll;

  constructor(private readonly db: Db) {
    this.insertStmt = db.prepare(`
      INSERT INTO events (
        site_id, type, name, properties, ts, received_at, visitor_hash, session_id, anonymous_id, user_id,
        url, path, referrer, referrer_host, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        browser, os, device, language, screen_width, title, country, region, city, timezone,
        screen_height, viewport_width, viewport_height, pixel_ratio, color_scheme, connection, context
      ) VALUES (
        @siteId, @type, @name, @properties, @ts, @receivedAt, @visitorHash, @sessionId, @anonymousId, @userId,
        @url, @path, @referrer, @referrerHost, @source, @utmSource, @utmMedium, @utmCampaign, @utmTerm, @utmContent,
        @browser, @os, @device, @language, @screenWidth, @title, @country, @region, @city, @timezone,
        @screenHeight, @viewportWidth, @viewportHeight, @pixelRatio, @colorScheme, @connection, @context
      )`);
    this.insertAll = db.transaction((events: TrackedEvent[]) => {
      for (const e of events) {
        this.insertStmt.run({
          siteId: e.siteId,
          type: e.type,
          name: e.name,
          properties: JSON.stringify(e.properties),
          ts: e.ts,
          receivedAt: e.receivedAt,
          visitorHash: e.visitorHash,
          sessionId: e.sessionId,
          anonymousId: e.anonymousId,
          userId: e.userId,
          url: e.url,
          path: e.path,
          referrer: e.referrer,
          referrerHost: e.referrerHost,
          source: e.source,
          utmSource: e.utm.source,
          utmMedium: e.utm.medium,
          utmCampaign: e.utm.campaign,
          utmTerm: e.utm.term,
          utmContent: e.utm.content,
          browser: e.browser,
          os: e.os,
          device: e.device,
          language: e.language,
          screenWidth: e.screenWidth,
          title: e.title,
          country: e.country,
          region: e.region,
          city: e.city,
          timezone: e.timezone,
          screenHeight: e.screenHeight,
          viewportWidth: e.viewportWidth,
          viewportHeight: e.viewportHeight,
          pixelRatio: e.pixelRatio,
          colorScheme: e.colorScheme,
          connection: e.connection,
          context: JSON.stringify(e.context),
        });
      }
    });
  }

  insertMany(events: TrackedEvent[]): void {
    if (events.length) this.insertAll(events);
  }

  purgeBefore(timestamp: number): number {
    return this.db.prepare('DELETE FROM events WHERE received_at < ?').run(timestamp).changes;
  }

  deleteBySite(siteId: string): number {
    return this.db.prepare('DELETE FROM events WHERE site_id = ?').run(siteId).changes;
  }
}

export class SqliteSaltRepository implements SaltRepository {
  constructor(private readonly db: Db) {}

  getOrCreate(day: string): string {
    this.db
      .prepare('INSERT OR IGNORE INTO salts (day, value) VALUES (?, ?)')
      .run(day, randomBytes(32).toString('hex'));
    const row = this.db.prepare('SELECT value FROM salts WHERE day = ?').get(day) as { value: string };
    return row.value;
  }

  purgeOlderThan(day: string): void {
    this.db.prepare('DELETE FROM salts WHERE day < ?').run(day);
  }
}

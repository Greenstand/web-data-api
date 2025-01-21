import FilterOptions from 'interfaces/FilterOptions';
import Tree from 'interfaces/Tree';
import HttpError from 'utils/HttpError';
import BaseRepository from './BaseRepository';
import Session from './Session';

type GeoJson = Partial<{
  geometry: {
    coordinates: number[];
  };
}>;

export default class TreeRepository extends BaseRepository<Tree> {
  constructor(session: Session) {
    super('trees', session);
  }

  async getById(id: number) {
    const object = await this.session
      .getDB()
      .select(
        this.session.getDB().raw(`
          trees.*,
          tree_species.id as species_id,
          tree_species.name as species_name,
          tree_species.desc as species_desc,
          region.name as country_name,
          region.id as country_id,
          entity.id as organization_id,
          entity.name as organization_name,
          wallet.wallet.id as wallet_id,
          wallet.wallet.name as wallet_name,
          wallet.token.id as token_id
          from trees
            left JOIN planter 
              on trees.planter_id = planter.id
            left JOIN entity 
              on entity.id = planter.organization_id
            left JOIN tree_species 
              on trees.species_id = tree_species.id 
            left JOIN region
              on ST_WITHIN(trees.estimated_geometric_location, region.geom)
              and region.type_id in (select id from region_type where type = 'country')
            left JOIN wallet.token
              on wallet.token.capture_id::text = trees.uuid::text
            left JOIN wallet.wallet
              on wallet.token.wallet_id = wallet.wallet.id
      `),
      )
      .where('trees.id', id)
      .first();

    if (!object) {
      throw new HttpError(404, `Can not find ${this.tableName} by id:${id}`);
    }
    return object;
  }

  async getByUUID(uuid: string) {
    const object = await this.session
      .getDB()
      .select(
        this.session.getDB().raw(`
          trees.*,
          tree_species.id as species_id,
          tree_species.name as species_name,
          tree_species.desc as species_desc,
          region.name as country_name,
          region.id as country_id,
          entity.id as organization_id,
          entity.name as organization_name,
          wallet.wallet.id as wallet_id,
          wallet.wallet.name as wallet_name,
          wallet.token.id as token_id
          from trees
            left JOIN planter 
              on trees.planter_id = planter.id
            left JOIN entity 
              on entity.id = planter.organization_id
            left JOIN tree_species 
              on trees.species_id = tree_species.id 
            left JOIN region
              on ST_WITHIN(trees.estimated_geometric_location, region.geom)
              and region.type_id in (select id from region_type where type = 'country')
            left JOIN wallet.token
              on wallet.token.capture_id::text = trees.uuid::text
            left JOIN wallet.wallet
              on wallet.token.wallet_id = wallet.wallet.id
      `),
      )
      .where('trees.uuid', uuid)
      .first();

    if (!object) {
      throw new HttpError(
        404,
        `Can not find ${this.tableName} by uuid:${uuid}`,
      );
    }
    return object;
  }

  async getByOrganization(
    organization_id: number,
    options: FilterOptions,
    totalCount = false,
  ) {
    const { limit, offset } = options;

    if (totalCount) {
      const totalSql = `
        SELECT
          COUNT(*)
        FROM trees
        LEFT JOIN planter ON trees.planter_id = planter.id
        WHERE
          (
            planter.organization_id in ( SELECT entity_id from getEntityRelationshipChildren(${organization_id}))
          OR
            trees.planting_organization_id = ${organization_id}
          ) and trees.active = true
      `;
      const total = await this.session.getDB().raw(totalSql);
      return parseInt(total.rows[0].count.toString());
    }

    const sql = `
      SELECT
      trees.*,
      tree_species.id as species_id,
      tree_species.name as species_name,
      region.id as country_id,
      region.name as country_name,
      entity.id as organization_id,
      entity.name as organization_name
      FROM trees
      LEFT JOIN planter ON trees.planter_id = planter.id
      LEFT JOIN entity ON entity.id = planter.organization_id
      LEFT JOIN tree_species 
        on trees.species_id = tree_species.id 
      LEFT JOIN region
        on ST_WITHIN(trees.estimated_geometric_location, region.geom)
        and region.type_id in (select id from region_type where type = 'country')
      WHERE
        (
          planter.organization_id in ( SELECT entity_id from getEntityRelationshipChildren(${organization_id}))
        OR
          trees.planting_organization_id = ${organization_id}
        )
        and trees.active = true
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getByDateRange(
    date_range: { startDate: string; endDate: string },
    options: FilterOptions,
    totalCount = false,
  ) {
    const { limit, offset } = options;
    const startDateISO = `${date_range.startDate}T00:00:00.000Z`;
    const endDateISO = new Date(
      new Date(`${date_range.endDate}T00:00:00.000Z`).getTime() + 86400000,
    ).toISOString();

    if (totalCount) {
      const totalSql = `
        SELECT
        COUNT(*)
        FROM trees
        WHERE time_created >= '${startDateISO}'::timestamp
        AND time_created < '${endDateISO}'::timestamp
        and trees.active = true
      `;
      const total = await this.session.getDB().raw(totalSql);
      return parseInt(total.rows[0].count.toString());
    }

    const sql = `
      SELECT
      trees.*,
      tree_species.id as species_id,
      tree_species.name as species_name,
      region.id as country_id,
      region.name as country_name,
      entity.id as organization_id,
      entity.name as organization_name
      FROM trees
      LEFT JOIN planter ON trees.planter_id = planter.id
      LEFT JOIN entity ON entity.id = planter.organization_id
      LEFT JOIN tree_species 
        on trees.species_id = tree_species.id 
      LEFT JOIN region
        on ST_WITHIN(trees.estimated_geometric_location, region.geom)
        and region.type_id in (select id from region_type where type = 'country')
      WHERE time_created >= '${startDateISO}'::timestamp
      AND time_created < '${endDateISO}'::timestamp
      and trees.active = true
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getByTag(tag: string, options: FilterOptions, totalCount = false) {
    const { limit, offset } = options;

    if (totalCount) {
      const totalSql = `
      SELECT 
        COUNT(*)
      FROM trees
      INNER JOIN tree_tag 
        on tree_tag.tree_id = trees.id
      INNER JOIN tag 
        on tree_tag.tag_id = tag.id
      WHERE 
        tag.tag_name in ('${tag}')
        and trees.active = true
      `;
      const total = await this.session.getDB().raw(totalSql);
      return parseInt(total.rows[0].count.toString());
    }
    const sql = `
    SELECT 
    trees.*,
    tree_species.id as species_id,
    tree_species.name as species_name,
    region.id as country_id,
    region.name as country_name,
    entity.id as organization_id,
    entity.name as organization_name
    FROM trees
    LEFT JOIN planter ON trees.planter_id = planter.id
    LEFT JOIN entity ON entity.id = planter.organization_id
    LEFT JOIN tree_species 
      on trees.species_id = tree_species.id 
    LEFT JOIN region
      on ST_WITHIN(trees.estimated_geometric_location, region.geom)
      and region.type_id in (select id from region_type where type = 'country')
    INNER JOIN tree_tag 
      on tree_tag.tree_id = trees.id
    INNER JOIN tag 
      on tree_tag.tag_id = tag.id
    WHERE 
      tag.tag_name in ('${tag}')
      and trees.active = true
    LIMIT ${limit}
    OFFSET ${offset}
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getFeaturedTree() {
    const sql = `
      SELECT trees.* ,tree_species.name as species_name,
      country.id as country_id, country.name as country_name
      FROM trees 
      join (
      --- convert json array to row
      SELECT json_array_elements(data -> 'trees') AS tree_id FROM webmap.config WHERE name = 'featured-tree'
      ) AS t ON 
      --- cast json type t.tree_id to integer
      t.tree_id::text::integer = trees.id
      LEFT JOIN tree_species 
      ON trees.species_id = tree_species.id
      LEFT JOIN region as country ON ST_WITHIN(trees.estimated_geometric_location, country.geom)
            and country.type_id in
              (SELECT id FROM region_type WHERE type = 'country')
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getByWallet(
    wallet_id: string,
    options: FilterOptions,
    totalCount = false,
  ) {
    const { limit, offset } = options;

    if (totalCount) {
      const totalSql = `
        SELECT
          COUNT(*)
        FROM trees
        LEFT JOIN wallet.token ON token.capture_id::text = trees.uuid
        WHERE wallet.token.wallet_id = '${wallet_id}'
        and trees.active = true
      `;
      const total = await this.session.getDB().raw(totalSql);
      return parseInt(total.rows[0].count.toString());
    }

    const sql = `
      SELECT
      trees.*
      FROM trees
      LEFT JOIN wallet.token ON token.capture_id::text = trees.uuid
      WHERE wallet.token.wallet_id = '${wallet_id}'
      and trees.active = true
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getByGeometry(geoJsonArr: GeoJson[], totalCount = false) {
    const pointArray = geoJsonArr.map(
      (item) =>
        `ST_MakePoint(${item.geometry?.coordinates[0]}, ${item.geometry?.coordinates[1]})`,
    );
    pointArray.push(
      `ST_MakePoint(${geoJsonArr[0].geometry?.coordinates[0]}, ${geoJsonArr[0].geometry?.coordinates[1]})`,
    );
    if (totalCount) {
      const totalSql = `
        SELECT
      COUNT(*)
      FROM trees t
      WHERE
      ST_CONTAINS(
      ST_SETSRID(ST_CONVEXHULL(ST_MAKELINE(ARRAY[${pointArray.toString()}])), 4326),
      ST_SETSRID(ST_POINT(t.lon, t.lat), 4326)
      )
      `;
      const total = await this.session.getDB().raw(totalSql);
      return parseInt(total.rows[0].count.toString());
    }

    const sql = `
      SELECT
      *
      FROM trees t
      WHERE
      ST_CONTAINS(
      ST_SETSRID(ST_CONVEXHULL(ST_MAKELINE(ARRAY[${pointArray.toString()}])), 4326),
      ST_SETSRID(ST_POINT(t.lon, t.lat), 4326)
      )
      `;

    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }
}

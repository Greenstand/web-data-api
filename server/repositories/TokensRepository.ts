import FilterOptions from 'interfaces/FilterOptions';
import Token from 'interfaces/Token';
import HttpError from 'utils/HttpError';
import BaseRepository from './BaseRepository';
import Session from 'infra/database/Session';
import { TokenFilter } from 'models/Tokens';

export default class TokensRepository extends BaseRepository<Token> {
  constructor(session: Session) {
    super('wallet.token', session);
  }

  async getById(tokenId: string): Promise<Token> {
    const sql = `
    select wallet.token.*,public.trees.id as tree_id,public.trees.image_url as tree_image_url,
    public.tree_species.name as tree_species_name
    from wallet.token
      left join public.trees on 
        wallet.token.capture_id::text = public.trees.uuid::text
      left join public.tree_species 
        on public.trees.species_id = public.tree_species.id 
      where  wallet.token.id = '${tokenId}'
`;

    const object = await this.session.getDB().raw(sql);

    if (object?.rows?.length) {
      return object.rows[0];
    }
    throw new HttpError(404, `Can not find ${this.tableName} by id:${tokenId}`);
  }

  async getByFilter(
    filter: TokenFilter,
    options: FilterOptions,
  ): Promise<Token[]> {
    const { limit, offset } = options;
    const { withCapture, withPlanter } = filter;

    const wihtPlanterQueryPart1 = `planter.id as planter_id,
      planter.first_name as planter_first_name,
      planter.last_name as planter_last_name,
      planter.image_url as planter_photo_url
    `;

    const wihtPlanterQueryPart2 = `left join public.planter as planter on
      capture.planter_id = planter.id
    `;
    let wihtCaptureQueryPart1 = `capture.image_url as capture_photo_url`;

    const wihtCaptureQueryPart2 = `left join public.trees as capture on
    capture.uuid::text = wlt_tkn.capture_id::text
  `;

    let sql = '';

    if (withCapture || withPlanter) {
      sql += `select wlt_tkn.*,`;
    } else {
      sql += `select wlt_tkn.*`;
    }

    if (withCapture && withPlanter) {
      wihtCaptureQueryPart1 += ',';
    }

    sql += `${withCapture ? wihtCaptureQueryPart1 : ''} 
      ${withPlanter ? wihtPlanterQueryPart1 : ''}
      from wallet.token as wlt_tkn
      left join wallet.wallet as wlt_wallet on
      wlt_wallet.id = wlt_tkn.wallet_id
      ${withCapture || withPlanter ? wihtCaptureQueryPart2 : ''}
      ${withPlanter ? wihtPlanterQueryPart2 : ''}
      where wlt_wallet.id::text = '${filter.wallet}' or 
      wlt_wallet.name = '${filter.wallet}'
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    const object = await this.session.getDB().raw(sql);
    return object.rows;
  }

  async getCountByFilter(filter: TokenFilter): Promise<number> {
    const sql = `SELECT
        COUNT(*)
      from wallet.token as wlt_tkn
      left join wallet.wallet as wlt_wallet on
      wlt_wallet.id = wlt_tkn.wallet_id
      where wlt_wallet.id::text = '${filter.wallet}' or 
      wlt_wallet.name = '${filter.wallet}'
    `;
    const total = await this.session.getDB().raw(sql);
    return +total.rows[0].count.toString();
  }
}

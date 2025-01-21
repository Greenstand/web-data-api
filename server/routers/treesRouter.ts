import express from 'express';
import Joi from 'joi';
import FilterOptions from 'interfaces/FilterOptions';
import { handlerWrapper } from './utils';
import Session from '../infra/database/Session';
import TreeRepository from '../infra/database/TreeRepository';
import TreeModel from '../models/Tree';
import HttpError from '../utils/HttpError';

const router = express.Router();

type GeoJson = Partial<{
  geometry: {
    coordinates: number[];
  };
}>;

type Filter = Partial<{
  planter_id: number;
  organization_id: number;
  date_range: { startDate: string; endDate: string };
  tag: string;
  wallet_id: string;
  active: true;
  geoJsonArr: GeoJson[];
}>;

router.get(
  '/featured',
  handlerWrapper(async (req, res) => {
    const repo = new TreeRepository(new Session());
    const exe = TreeModel.getFeaturedTree(repo);
    const result = await exe();
    res.send({
      trees: result,
    });
    res.end();
  }),
);

router.get(
  '/:val',
  handlerWrapper(async (req, res) => {
    const repo = new TreeRepository(new Session());
    let result;
    if (isNaN(Number(req.params.val))) {
      Joi.assert(req.params.val, Joi.string().guid().required());
      const exe = TreeModel.getByUUID(repo);
      result = await exe(req.params.val);
    } else {
      Joi.assert(req.params.val, Joi.number().required());
      const exe = TreeModel.getById(repo);
      result = await exe(req.params.val);
    }

    if (result.active === false) {
      throw new HttpError(404, `Can not find trees by id:${result.id}`);
    }

    res.send(result);
    res.end();
  }),
);

router.get(
  '/',
  handlerWrapper(async (req, res) => {
    Joi.assert(
      req.query,
      Joi.object().keys({
        planter_id: Joi.number().integer().min(0),
        organization_id: Joi.number().integer().min(0),
        wallet_id: Joi.string().uuid(),
        tag: Joi.string(),
        limit: Joi.number().integer().min(1).max(1000),
        order_by: Joi.string(),
        desc: Joi.boolean(),
        offset: Joi.number().integer().min(0),
        startDate: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        geoJsonStr: Joi.string(),
      }),
    );
    const {
      limit = 20,
      offset = 0,
      order_by,
      desc = true,
      planter_id,
      organization_id,
      startDate,
      endDate,
      tag,
      wallet_id,
      geoJsonStr,
    } = req.query;
    const repo = new TreeRepository(new Session());
    const filter: Filter = { active: true };
    const options: FilterOptions = {
      limit,
      offset,
      orderBy: {
        column: order_by || 'time_created',
        direction: desc === true ? 'desc' : 'asc',
      },
    };

    if (planter_id) {
      filter.planter_id = planter_id;
    } else if (organization_id) {
      filter.organization_id = organization_id;
    } else if (startDate && endDate) {
      filter.date_range = { startDate, endDate };
    } else if (tag) {
      filter.tag = tag;
    } else if (wallet_id) {
      filter.wallet_id = wallet_id;
    } else if (geoJsonStr) {
      filter.geoJsonArr = JSON.parse(decodeURIComponent(geoJsonStr));
    }

    const result = await TreeModel.getByFilter(repo)(filter, options);
    res.send({
      total: await TreeModel.countByFilter(repo)(filter, options),
      offset,
      limit,
      trees: result,
    });
    res.end();
  }),
);

export default router;

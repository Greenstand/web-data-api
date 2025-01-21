import supertest from 'supertest';
import app from '../../server/app';

describe('trees', () => {
  it('trees/{id}', async () => {
    const response = await supertest(app).get('/trees/952022');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 952022,
      lat: expect.anything(),
      lon: expect.anything(),
      species_id: 113,
      species_name: 'bob',
      country_name: 'China',
      country_id: 6632544,
      organization_id: 11,
      organization_name: 'FCC',
    });
  });

  it('Unknown tree', async () => {
    const response = await supertest(app).get('/trees/1');
    expect(response.status).toBe(404);
  });

  it('trees?limit=1&offset=0', async () => {
    const response = await supertest(app).get('/trees?limit=1&offset=0');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      trees: expect.anything(),
    });
  });

  it('trees?limit=1&offset=0', async () => {
    const response = await supertest(app).get('/trees?limit=1&offset=0');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      trees: expect.anything(),
    });
  });

  it(
    'trees?limit=1&organization_id=11',
    async () => {
      const response = await supertest(app).get(
        '/trees?limit=1&organization_id=11',
      );
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        trees: expect.anything(),
      });
      expect(response.body.trees[0]).toMatchObject({
        organization_id: 11,
      });
    },
    1000 * 60,
  );

  it(
    'trees?startDate=2021-02-26&endDate=2021-12-22',
    async () => {
      const response = await supertest(app).get(
        '/trees?startDate=2021-02-26&endDate=2021-12-22',
      );
      expect(response.status).toBe(200);
      for (let i = 0; i < response.body.trees.length; i++) {
        expect(
          new Date(response.body.trees[i].time_created).getTime(),
        ).toBeGreaterThanOrEqual(new Date('2021-02-26T00:00:00Z').getTime());
        expect(
          new Date(response.body.trees[i].time_created).getTime(),
        ).toBeLessThan(new Date('2021-12-23T00:00:00Z').getTime());
      }
    },
    1000 * 60,
  );

  it(
    'trees/featured',
    async () => {
      const response = await supertest(app).get('/trees/featured');
      expect(response.status).toBe(200);
      // expect(response.body).toMatchObject({
      //   trees: expect.anything(),
      // });
      expect(response.body.trees[0]).toMatchObject({
        id: expect.any(Number),
      });
    },
    1000 * 10,
  );

  it(
    'trees?tag=photoless',
    async () => {
      const response = await supertest(app).get('/trees?tag=photoless');
      const expectedIds = [186685, 878654];
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      const returnedIds = [
        response.body.trees[0].id,
        response.body.trees[1].id,
      ];
      expect(returnedIds).toEqual(expectedIds);
    },
    1000 * 30,
  );

  it(
    'trees?planter_id=3584&desc=true',
    async () => {
      const response = await supertest(app).get(
        '/trees?planter_id=3584&limit=1&order_by=created_at',
      );
      expect(response.status).toBe(200);
      expect(response.body.trees[0]).toMatchObject({
        id: 938209,
        planter_id: 3584,
      });
    },
    1000 * 30,
  );

  it(
    'trees?planter_id=3584&desc=false',
    async () => {
      const response = await supertest(app).get(
        '/trees?planter_id=3584&order_by=created_at&desc=false&limit=1',
      );
      expect(response.status).toBe(200);
      expect(response.body.trees[0]).toMatchObject({
        id: 937190,
        planter_id: 3584,
      });
    },
    1000 * 30,
  );

  it(
    'trees/?geoJsonStr=encodedgeoJson',
    async () => {
      const geoJsonArr = [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-122.6064, 39.0619] },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-123.3139, 38.1519] },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-121.1001, 37.8879] },
          properties: {},
        },
      ];

      const encodedgeoJson = encodeURIComponent(JSON.stringify(geoJsonArr));

      const response = await supertest(app).get(
        `/trees?geoJsonStr=${encodedgeoJson}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.trees.length).toBe(145);
    },
    1000 * 30,
  );
});

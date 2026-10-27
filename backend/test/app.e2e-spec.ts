import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Valeurs factices : ces tests ne contactent jamais Supabase.
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test';

describe('StudentHub API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('refuse un paramètre public invalide (400)', () => {
    return request(app.getHttpServer())
      .get('/public/contents?limit=1000')
      .expect(400);
  });

  it("refuse l'admin sans token (401)", () => {
    return request(app.getHttpServer()).get('/contents').expect(401);
  });

  it("refuse de créer un contenu sans token, même avec des données valides (401)", () => {
    return request(app.getHttpServer())
      .post('/contents')
      .send({ title: 'T', slug: 't', summary: 's', body: 'b' })
      .expect(401);
  });
});

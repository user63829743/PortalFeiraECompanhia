import test from "node:test";
import assert from "node:assert/strict";
import { filterRegistrations, mapRegistration, isPublicProfileComplete } from "../apps/admin/server.js";

test("mapRegistration converte stall_registrations para o formato do painel", () => {
  const record = mapRegistration({
    id: 7,
    full_name: "Maria da Silva",
    cpf_cnpj: "12345678901",
    email: "maria@example.com",
    phone: "61999998888",
    business_name: "Produtos da Maria",
    region: "Ceilândia",
    category: "Artesanato",
    status: "approved",
    public_ready: false,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z"
  });

  assert.equal(record.name, "Maria da Silva");
  assert.equal(record.businessName, "Produtos da Maria");
  assert.equal(record.status, "approved");
  assert.equal(record.databaseStatus, "approved");
});

test("filterRegistrations localiza feirante por nome, negócio, telefone ou região", () => {
  const records = [
    { id: 1, name: "Maria da Silva", businessName: "Produtos da Maria", email: "maria@example.com", phone: "61999998888", category: "Artesanato", region: "Ceilândia", status: "active" },
    { id: 2, name: "João Santos", businessName: "Doces do João", email: "joao@example.com", phone: "6133334444", category: "Alimentação", region: "Gama", status: "analyzing" }
  ];

  assert.deepEqual(filterRegistrations(records, { query: "maria", status: "all" }).map((item) => item.id), [1]);
  assert.deepEqual(filterRegistrations(records, { query: "gama", status: "analyzing" }).map((item) => item.id), [2]);
  assert.deepEqual(filterRegistrations(records, { query: "", status: "active" }).map((item) => item.id), [1]);
});

test("status Ativa só aparece quando approved e public_ready são verdadeiros", () => {
  const record = mapRegistration({ status: "approved", public_ready: true });
  assert.equal(record.status, "active");
});

test("filtro Feirantes exclui cadastros em análise e recusados", () => {
  const records = [
    { id: 1, databaseStatus: "approved", status: "approved", name: "Aprovada", businessName: "A", category: "Artesanato", region: "Gama" },
    { id: 2, databaseStatus: "reviewing", status: "analyzing", name: "Análise", businessName: "B", category: "Alimentos", region: "Ceilândia" },
    { id: 3, databaseStatus: "rejected", status: "rejected", name: "Recusada", businessName: "C", category: "Roupas", region: "Plano Piloto" }
  ];
  assert.deepEqual(filterRegistrations(records, { view: "feirantes" }).map((item) => item.id), [1]);
  assert.deepEqual(filterRegistrations(records, { view: "registrations" }).map((item) => item.id), [2, 3]);
});

test("perfil incompleto permanece inativo e perfil completo pode ser ativado", () => {
  assert.equal(isPublicProfileComplete({ business_name: "Banca", region: "Gama", category: "Artesanato", public_description: "Texto público completo", photo_url: "foto", logo_url: "logo" }), true);
  assert.equal(isPublicProfileComplete({ business_name: "Banca", region: "Gama", category: "Artesanato", public_description: "curto", photo_url: "foto", logo_url: "logo" }), false);
});

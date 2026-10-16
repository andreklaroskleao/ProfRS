import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWorkload, formatMinutes, parseHoursToMinutes } from '../js/modules/jornada.js';

test('a jornada de 20 horas respeita dois terços e um terço', () => {
  assert.deepEqual(calculateWorkload(20), {
    totalMinutes: 1200,
    maxContactMinutes: 800,
    minPlanningMinutes: 400
  });
  assert.equal(formatMinutes(calculateWorkload(20).maxContactMinutes), '13h20');
  assert.equal(formatMinutes(calculateWorkload(20).minPlanningMinutes), '6h40');
});

test('a jornada de 40 horas respeita dois terços e um terço', () => {
  assert.deepEqual(calculateWorkload(40), {
    totalMinutes: 2400,
    maxContactMinutes: 1600,
    minPlanningMinutes: 800
  });
  assert.equal(formatMinutes(calculateWorkload(40).maxContactMinutes), '26h40');
  assert.equal(formatMinutes(calculateWorkload(40).minPlanningMinutes), '13h20');
});

test('a jornada personalizada converte frações de hora em minutos cronológicos', () => {
  assert.equal(parseHoursToMinutes(30.5), 1830);
  assert.deepEqual(calculateWorkload(30.5), {
    totalMinutes: 1830,
    maxContactMinutes: 1220,
    minPlanningMinutes: 610
  });
});

test('minutos fracionários são arredondados para limites conservadores', () => {
  const result = calculateWorkload(0.25);
  assert.equal(result.totalMinutes, 15);
  assert.equal(result.maxContactMinutes, 10);
  assert.equal(result.minPlanningMinutes, 5);
});

test('a calculadora rejeita cargas fora dos limites e entradas inválidas', () => {
  for (const value of [0, -1, 81, 'abc', Number.NaN]) {
    assert.throws(() => calculateWorkload(value));
  }
});

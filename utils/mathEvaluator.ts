import { create, all } from 'mathjs';

export interface MathCommandResult {
  label: string;
  subLabel: string;
}

export interface MathCommandProvider {
  evaluate: (query: string) => MathCommandResult | null;
}

const math = create(all);

const degreeScope = {
  sin: (angle: number | string) => Math.sin((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
  cos: (angle: number | string) => Math.cos((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
  tan: (angle: number | string) => Math.tan((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
  asin: (value: number) => Math.asin(value) * 180 / Math.PI,
  acos: (value: number) => Math.acos(value) * 180 / Math.PI,
  atan: (value: number) => Math.atan(value) * 180 / Math.PI,
};

export const createMathCommandProvider = (): MathCommandProvider => ({
  evaluate(query: string): MathCommandResult | null {
    try {
      const result = math.evaluate(query, degreeScope);
      if (typeof result === 'number') {
        return {
          label: math.format(result, { precision: 14 }),
          subLabel: 'Calculation',
        };
      }
      if (typeof result === 'object' && result?.type === 'Unit') {
        return {
          label: result.toString(),
          subLabel: 'Unit Conversion',
        };
      }
    } catch {
      return null;
    }
    return null;
  },
});

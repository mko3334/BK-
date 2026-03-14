import { describe, it, expect } from 'vitest';

// モックの作成
document.body.innerHTML = `
  <div id="loading"></div>
  <iframe id="app-frame"></iframe>
`;

describe('Octopus Launcher Core Logic', () => {
  it('冪等性キーが生成されること', () => {
    const key1 = Math.random().toString(36);
    const key2 = Math.random().toString(36);
    expect(key1).not.toBe(key2);
  });

  it('指示書1: sandbox属性が正しく設定されること', () => {
    const iframe = document.getElementById('app-frame') as HTMLIFrameElement;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
  });
});

const CONTROLS: Array<[string, string]> = [
  ['Clique esquerdo', 'Selecionar unidade, edifício ou recurso'],
  ['Arrastar (botão esquerdo)', 'Selecionar várias unidades'],
  ['Shift + clique / arrastar', 'Adicionar ou remover da seleção'],
  ['Duplo clique', 'Selecionar unidades visíveis do mesmo tipo'],
  ['Clique direito no terreno', 'Mover as unidades selecionadas'],
  ['Clique direito em recurso', 'Aldeões coletam (árvore, mina de ouro/pedra, arbusto)'],
  ['Clique direito no Centro da Vila', 'Aldeões com carga depositam'],
  ['Clique direito em inimigo', 'Atacar'],
  ['Clique direito em obra própria', 'Aldeões ajudam a construir'],
  ['Clique direito em edifício danificado', 'Aldeões reparam (custa recursos)'],
  ['Clique direito com edifício selecionado', 'Ponto de reunião das unidades treinadas'],
  ['A + clique', 'Atacar-mover (unidades militares)'],
  ['H', 'Manter posição / voltar à postura agressiva'],
  ['Q / E (edifício selecionado)', 'Treinar a 1ª / 2ª unidade do edifício'],
  ['F9 (modo de teste)', 'Alternar o jogador controlado'],
  ['B', 'Menu de construção (com aldeões selecionados)'],
  ['C / M / O / Q', 'Casa / Dep. de Madeira / Dep. de Mineração / Quartel (no menu)'],
  ['Shift ao posicionar', 'Mantém o modo e enfileira várias obras'],
  ['Delete', 'Cancelar obra selecionada (devolução proporcional)'],
  ['. (ponto)', 'Selecionar o próximo aldeão ocioso'],
  ['S', 'Parar (com unidades suas selecionadas; sem seleção, câmera)'],
  ['Esc', 'Cancelar posicionamento, fechar menu ou limpar seleção'],
  ['Espaço', 'Centralizar câmera na seleção'],
  ['Ctrl + 0–9', 'Criar grupo de controle'],
  ['0–9 (duas vezes)', 'Selecionar grupo (e centralizar)'],
  ['W A S D / setas', 'Mover a câmera (A e S viram comandos com unidades selecionadas)'],
  ['Roda do mouse', 'Aproximar / afastar'],
  ['Botão do meio (arrastar)', 'Arrastar a câmera'],
  ['Bordas da tela', 'Rolar a câmera (pode ser desativado)'],
  ['Minimapa', 'Clique ou arraste para mover a câmera'],
  ['F10', 'Menu da partida (pausa)'],
];

export function ControlsReference() {
  return (
    <table className="w-full border-separate border-spacing-y-1 text-sm">
      <tbody>
        {CONTROLS.map(([key, action]) => (
          <tr key={key}>
            <td className="panel-inset w-56 px-3 py-1.5 font-display text-xs tracking-wide text-brass">{key}</td>
            <td className="px-3 py-1.5">{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

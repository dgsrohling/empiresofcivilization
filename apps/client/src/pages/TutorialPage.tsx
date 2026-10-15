import { ControlsReference } from '../components/ControlsReference';
import { ScreenFrame } from '../components/ScreenFrame';
import { useAppStore } from '../stores/appStore';

export function TutorialPage() {
  const go = useAppStore((s) => s.go);
  return (
    <ScreenFrame title="Tutorial e Controles" onBack={() => go('menu')}>
      <div className="mb-4 flex flex-col gap-2 text-sm">
        <p>Você começa com um Centro da Vila, cinco aldeões e um batedor. Nesta versão (Fase 4) é possível:</p>
        <ol className="ml-5 list-decimal space-y-1 text-parchment-dim">
          <li>Explorar o mapa movendo a câmera (WASD, setas, bordas, botão do meio ou minimapa).</li>
          <li>Selecionar unidades com clique ou arrastando um retângulo.</li>
          <li>Enviar unidades com o clique direito — elas contornam florestas, água, montanhas e edifícios.</li>
          <li>Coletar recursos: selecione aldeões e clique com o botão direito em árvores, minas ou arbustos. Eles enchem a carga (10), levam ao Centro da Vila e voltam sozinhos.</li>
          <li>Quando uma fonte se esgota, o aldeão procura outra do mesmo tipo por perto.</li>
          <li>Construir: selecione aldeões, pressione B (ou o botão Construir), escolha o edifício e clique no mapa. A área fica verde quando o local é válido. Casas aumentam a população; depósitos encurtam o transporte de madeira e minérios.</li>
          <li>Treinar unidades: selecione o Centro da Vila (aldeões), o Quartel (espadachins e lanceiros) ou o Campo de Arqueiros e use os botões (Q/E). Clique direito com o edifício selecionado define o ponto de reunião.</li>
          <li>Combater: botão direito em um inimigo ataca; A + clique faz atacar-mover. Lanceiros vencem cavalaria, a cavalaria pega arqueiros, e arqueiros causam dano à distância, mas são frágeis.</li>
          <li>Acompanhar a economia na barra superior (aldeões por recurso, ociosos) e no painel “Economia”.</li>
          <li>Inspecionar unidades, edifícios e recursos no painel inferior.</li>
        </ol>
        <p className="text-xs text-parchment-dim">
          Observação: a tecla S executa “Parar” quando há unidades suas selecionadas; sem seleção, ela move a câmera para baixo.
        </p>
      </div>
      <ControlsReference />
    </ScreenFrame>
  );
}

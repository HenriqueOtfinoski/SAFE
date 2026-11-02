# GPIO e máquina de estados finitos

O módulo `software/controle_gpio.py` controla as saídas que representam os sinais
`S` (Strobe) e `V` (Validade) da FSM. O sinal `CLK` é disponibilizado para pulso
de clock manual pelo controlador e pelo testador GPIO.

## Mapeamento

| Sinal | Função | GPIO BCM | Pino físico |
| --- | --- | ---: | ---: |
| `S` | Processamento/Strobe | 17 | 11 |
| `V` | Resultado/Validade | 27 | 13 |
| `CLK` | Pulso de amostragem/latch | 22 | 15 |
| `GND` | Referência comum | — | 6, 9 ou 14 |

Os três GPIO são configuráveis com `PIN_STROBE`, `PIN_VALIDADE` e `PIN_CLOCK`.
Consulte o [diagrama de arquitetura](../diagramas/arquitetura.drawio) e o
[diagrama da FSM](../diagramas/maquina_de_estados.drawio).

> **Atenção:** GPIO do Raspberry Pi operam em 3,3 V e não são tolerantes a 5 V.
> Antes de conectar a FSM, confirme níveis lógicos, referência de terra e
> necessidade de interface/condicionamento elétrico. Não conecte sinais de 5 V
> diretamente aos GPIO.

## Estados representados

| Estado | `S` | `V` | Significado |
| --- | :---: | :---: | --- |
| Aguardando | `0` | `0` | Nenhum rosto em processamento |
| Validando | `1` | `0` | Rosto detectado e identificação em andamento |
| Aceito | `0` | `1` | Pessoa reconhecida |
| Negado | `1` | `1` | Pessoa desconhecida ou não confirmada |

Ao iniciar, o controlador define Aguardando. O processo de reconhecimento define
Validando quando encontra um rosto e mantém Aceito ou Negado pelo intervalo
`DURACAO_STROBE`. Sem hardware GPIO acessível, usa modo simulado; nesse modo as
alterações são registradas, mas não chegam a pinos físicos.

## Teste manual

Com as dependências instaladas, execute a partir de `software/`:

```bash
python testar_gpio.py
```

Digite `A`, `V`, `C` (ou `E`) ou `N` para selecionar um estado; `K` envia um pulso
de clock e `Q` encerra. O encerramento retorna as saídas para Aguardando.

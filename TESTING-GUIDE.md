# Guia Completo de Testes - Assistente de IA Municipal

Este guia fornece uma abordagem sistemática para testar todas as capacidades e funcionalidades do Assistente de IA.

## 📋 Índice

1. [Testes Automatizados](#testes-automatizados)
2. [Testes Manuais - Quick Suggestions](#testes-manuais---quick-suggestions)
3. [Testes de Queries de Análise](#testes-de-queries-de-análise)
4. [Testes de Queries de Notificação](#testes-de-queries-de-notificação)
5. [Testes de Busca por Nome](#testes-de-busca-por-nome)
6. [Testes de Edge Cases](#testes-de-edge-cases)
7. [Verificação de Qualidade](#verificação-de-qualidade)
8. [Checklist de Validação](#checklist-de-validação)

---

## 🚀 Testes Automatizados

### Executar Teste Completo

```bash
# Teste todos os quick-suggestion buttons
node test-all-quick-suggestions.js

# Teste específico de uma query
node -e "
const orchestrator = require('./orchestrator');
(async () => {
  const result = await orchestrator('SUA QUERY AQUI');
  console.log(JSON.stringify(result, null, 2));
})();
"
```

### O que o teste automatizado verifica:

✅ **Classificação de Intent**: Verifica se a query é classificada corretamente (knowledge/notification/ticket)  
✅ **Geração de Resposta**: Verifica se há resposta útil (sem mensagens de erro genéricas)  
✅ **Relatórios**: Verifica se relatórios estruturados são gerados com métricas  
✅ **Insights**: Verifica se insights úteis são fornecidos  
✅ **Recomendações**: Verifica se recomendações acionáveis são fornecidas  
✅ **Estatísticas**: Verifica se estatísticas são incluídas  

---

## 🎯 Testes Manuais - Quick Suggestions

### 1. Análise de Satisfação

**Query**: `Mostrar análise de satisfação`

**O que verificar:**
- [ ] Resposta contém métricas de satisfação (média, total de respostas)
- [ ] Relatório estruturado é gerado com:
  - [ ] Total de respostas
  - [ ] Satisfação média com interpretação (⚠️ Baixa / ✓ Moderada / ✓ Excelente)
  - [ ] Taxa de resposta
  - [ ] Cobertura geográfica (bairros)
  - [ ] Equidade entre bairros
- [ ] Insights são fornecidos (mínimo 3)
- [ ] Recomendações são acionáveis (mínimo 2)
- [ ] Link "Abrir relatório completo" funciona
- [ ] Relatório completo exibe todas as informações

### 2. Análise de Insatisfação

**Query**: `Encontrar moradores insatisfeitos`

**O que verificar:**
- [ ] Lista de moradores insatisfeitos é fornecida
- [ ] Prioridades são indicadas (ALTA/MÉDIA)
- [ ] Relatório inclui:
  - [ ] Total de cidadãos
  - [ ] Distribuição por prioridade
  - [ ] Distribuição geográfica (top 5 bairros)
  - [ ] Principais questões (top 5)
  - [ ] Taxa de contactabilidade (WhatsApp)
- [ ] Insights acionáveis são fornecidos
- [ ] Próximos passos recomendados são claros
- [ ] Templates de WhatsApp são sugeridos

### 3. Análise de Bairros

**Query**: `Quais bairros precisam de acompanhamento`

**O que verificar:**
- [ ] Análise geográfica é fornecida
- [ ] Bairros com baixo desempenho são identificados
- [ ] Diferenças entre bairros são quantificadas
- [ ] Recomendações específicas por bairro são fornecidas
- [ ] Relatório inclui métricas de equidade geográfica

### 4. Participação: Interessados

**Query**: `Listar moradores interessados em participar`

**O que verificar:**
- [ ] Lista de moradores interessados é fornecida
- [ ] Relatório inclui:
  - [ ] Total de interessados
  - [ ] Distribuição geográfica
  - [ ] Níveis de satisfação dos interessados
- [ ] Oportunidades de engajamento são identificadas
- [ ] Recomendações para eventos/grupos são fornecidas

### 5. Participação: Não Interessados

**Query**: `Mostrar moradores que não querem participar`

**O que verificar:**
- [ ] Lista de moradores não interessados é fornecida
- [ ] Relatório inclui análise do grupo
- [ ] Estratégias alternativas são sugeridas
- [ ] Insights sobre barreiras são fornecidos

### 6. Relatório: Satisfação por Idade

**Query**: `Relatório: Satisfação por idade`

**O que verificar:**
- [ ] Análise por faixa etária é fornecida
- [ ] Relatório identifica:
  - [ ] Faixa com maior satisfação
  - [ ] Faixa que precisa atenção
  - [ ] Diferenças entre faixas
- [ ] Insights específicos por idade são fornecidos

---

## 📊 Testes de Queries de Análise

### Queries Básicas de Análise

Teste estas variações para verificar robustez:

1. `Análise de satisfação`
2. `Mostrar análise de satisfação`
3. `Relatório de satisfação`
4. `Estatísticas de satisfação`
5. `Resumo de satisfação`

**O que verificar em todas:**
- [ ] Classificação correta como `knowledge` intent
- [ ] QueryType = `analysis`
- [ ] Relatório é gerado
- [ ] Insights são fornecidos
- [ ] Não é tratado como name search

### Queries de Análise Geográfica

1. `Análise por bairro`
2. `Quais bairros têm mais problemas`
3. `Comparar satisfação entre bairros`
4. `Bairros que precisam de atenção`

**O que verificar:**
- [ ] Análise geográfica é incluída
- [ ] Bairros são identificados e comparados
- [ ] Recomendações específicas por bairro são fornecidas

### Queries de Análise por Idade

1. `Satisfação por idade`
2. `Análise por faixa etária`
3. `Qual faixa etária está mais satisfeita`

**O que verificar:**
- [ ] Análise por idade é fornecida
- [ ] Faixas etárias são identificadas
- [ ] Diferenças entre faixas são destacadas

---

## 📢 Testes de Queries de Notificação

### Queries de Segmentação

1. `Listar moradores insatisfeitos`
2. `Mostrar cidadãos satisfeitos`
3. `Quem está interessado em participar`
4. `Moradores que não querem participar`

**O que verificar:**
- [ ] Lista de residentes é fornecida
- [ ] Dados de contato (WhatsApp) estão incluídos
- [ ] Prioridades são indicadas quando relevante
- [ ] Relatório de segmento é gerado
- [ ] Templates de mensagem são sugeridos

### Queries de Ação

1. `Enviar mensagem para insatisfeitos`
2. `Contatar moradores do bairro X`
3. `Quem precisa de follow-up`

**O que verificar:**
- [ ] Segmento correto é identificado
- [ ] Lista acionável é fornecida
- [ ] Recomendações de ação são claras

---

## 🔍 Testes de Busca por Nome

### Buscas Simples

1. `Encontrar João Silva`
2. `Buscar Maria Santos`
3. `Quem é Pedro Oliveira`

**O que verificar:**
- [ ] Busca por nome funciona corretamente
- [ ] Resultado é focado (não lista todos)
- [ ] Informações do cidadão são fornecidas
- [ ] Não gera insights genéricos desnecessários

### Buscas Parciais

1. `Encontrar João`
2. `Buscar pessoas com sobrenome Silva`

**O que verificar:**
- [ ] Busca parcial funciona
- [ ] Resultados são relevantes
- [ ] Múltiplos resultados são listados quando apropriado

---

## ⚠️ Testes de Edge Cases

### Queries Ambíguas

1. `Análise` (muito genérico)
2. `Mostrar` (sem contexto)
3. `Listar` (sem especificação)

**O que verificar:**
- [ ] Sistema pede esclarecimento ou fornece análise padrão
- [ ] Não retorna erro genérico

### Queries com Erros de Digitação

1. `Análise de satisfaçao` (sem acento)
2. `Mostrar analise` (sem acento)
3. `Encontrar moradores insatisfeitos` (plural)

**O que verificar:**
- [ ] Sistema normaliza e entende a query
- [ ] Resultados são corretos apesar do erro

### Queries em Inglês

1. `Show satisfaction analysis`
2. `Find dissatisfied residents`
3. `List interested residents`

**O que verificar:**
- [ ] Sistema entende queries em inglês
- [ ] Respostas podem ser em português ou inglês (dependendo da configuração)

### Queries sem Dados

**Cenário**: Banco de dados vazio ou sem respostas de pesquisa

**O que verificar:**
- [ ] Sistema informa que não há dados
- [ ] Sugere ações para coletar dados
- [ ] Não retorna erro genérico

---

## ✅ Verificação de Qualidade

### Checklist de Qualidade da Resposta

Para cada query testada, verifique:

#### 1. Estrutura da Resposta
- [ ] Resposta não está vazia
- [ ] Resposta tem mais de 50 caracteres (não é genérica)
- [ ] Não contém mensagens de erro genéricas
- [ ] Formatação é legível

#### 2. Relatório (quando aplicável)
- [ ] Relatório é gerado para queries de análise
- [ ] Relatório contém métricas numéricas
- [ ] Relatório tem interpretação contextual
- [ ] Relatório tem próximos passos
- [ ] Link para relatório completo funciona

#### 3. Insights
- [ ] Mínimo 2 insights são fornecidos para queries de análise
- [ ] Insights são específicos (não genéricos)
- [ ] Insights são baseados em dados reais
- [ ] Insights são acionáveis

#### 4. Recomendações
- [ ] Mínimo 2 recomendações são fornecidas para queries de análise
- [ ] Recomendações são específicas
- [ ] Recomendações são acionáveis
- [ ] Recomendações são relevantes para o contexto

#### 5. Dados de Residentes (quando aplicável)
- [ ] Lista de residentes é fornecida quando solicitada
- [ ] Dados de contato estão incluídos
- [ ] Informações são precisas
- [ ] Prioridades são indicadas quando relevante

#### 6. Performance
- [ ] Resposta é gerada em menos de 5 segundos
- [ ] Não há timeouts
- [ ] Sistema não trava

---

## 📝 Checklist de Validação Completa

### Funcionalidades Core

- [ ] **Classificação de Intent**: Todas as queries são classificadas corretamente
- [ ] **Geração de Resposta**: Todas as queries geram respostas úteis
- [ ] **Relatórios**: Relatórios são gerados para queries de análise
- [ ] **Insights**: Insights são fornecidos para queries de análise
- [ ] **Recomendações**: Recomendações são fornecidas para queries de análise
- [ ] **Busca por Nome**: Busca por nome funciona corretamente
- [ ] **Segmentação**: Segmentação de residentes funciona corretamente

### Quick Suggestions

- [ ] Análise de Satisfação
- [ ] Análise de Insatisfação
- [ ] Análise de Bairros
- [ ] Participação: Interessados
- [ ] Participação: Não Interessados
- [ ] Relatório: Satisfação por Idade

### Qualidade

- [ ] Respostas não são genéricas
- [ ] Relatórios são informativos
- [ ] Insights são acionáveis
- [ ] Recomendações são específicas
- [ ] Performance é aceitável

### Edge Cases

- [ ] Queries ambíguas são tratadas
- [ ] Erros de digitação são tolerados
- [ ] Queries em inglês funcionam
- [ ] Queries sem dados são tratadas graciosamente

---

## 🛠️ Scripts de Teste Úteis

### Teste Rápido de uma Query

```bash
node -e "
const orchestrator = require('./orchestrator');
(async () => {
  const query = 'SUA QUERY AQUI';
  console.log('Testing:', query);
  const result = await orchestrator(query);
  console.log('\\n✅ Success:', result.success);
  console.log('📊 Intent:', result.intent);
  console.log('📝 Response length:', result.response?.length);
  console.log('📄 Has report:', !!result.report);
  console.log('💡 Insights:', result.insights?.length || 0);
  console.log('📋 Recommendations:', result.recommendations?.length || 0);
  console.log('👥 Residents:', result.residents?.length || 0);
})();
"
```

### Teste de Múltiplas Queries

```bash
node -e "
const orchestrator = require('./orchestrator');
const queries = [
  'Mostrar análise de satisfação',
  'Encontrar moradores insatisfeitos',
  'Quais bairros precisam de acompanhamento'
];

(async () => {
  for (const query of queries) {
    console.log('\\n' + '='.repeat(60));
    console.log('Testing:', query);
    const result = await orchestrator(query);
    console.log('✅ Success:', result.success);
    console.log('📊 Intent:', result.intent);
    console.log('📄 Has report:', !!result.report);
    console.log('💡 Insights:', result.insights?.length || 0);
  }
})();
"
```

---

## 📊 Métricas de Sucesso

### Taxa de Sucesso Esperada

- **Classificação de Intent**: > 95%
- **Geração de Resposta Útil**: > 90%
- **Geração de Relatórios (análise)**: 100%
- **Geração de Insights (análise)**: 100%
- **Geração de Recomendações (análise)**: 100%
- **Performance (< 5s)**: > 95%

### Indicadores de Qualidade

- **Respostas Genéricas**: < 5%
- **Erros Não Tratados**: 0%
- **Timeouts**: 0%
- **Relatórios sem Métricas**: 0%

---

## 🐛 Como Reportar Problemas

Ao encontrar um problema, documente:

1. **Query exata** que causou o problema
2. **Resultado obtido** vs **Resultado esperado**
3. **Screenshot** (se aplicável)
4. **Logs do console** (se disponível)
5. **Passos para reproduzir**

---

## 📚 Próximos Passos

Após completar os testes:

1. Documente quaisquer problemas encontrados
2. Priorize correções baseado em impacto
3. Execute testes de regressão após correções
4. Atualize este guia com novos casos de teste

---

**Última atualização**: $(date)
**Versão do sistema**: Verificar em `orchestrator.js`


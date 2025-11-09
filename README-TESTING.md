# 🧪 Guia Rápido de Testes - Assistente de IA

## Testes Rápidos (Recomendado para começar)

### 1. Quick Check (Validação Rápida)
Testa apenas as funcionalidades críticas:

```bash
node test-quick-check.js
```

**Tempo estimado**: ~5 segundos  
**O que testa**: 3 queries críticas para validar que o sistema está funcionando

---

### 2. Teste de Quick Suggestions
Testa todos os botões de sugestão rápida:

```bash
node test-all-quick-suggestions.js
```

**Tempo estimado**: ~30 segundos  
**O que testa**: Todos os 6 quick-suggestion buttons

---

### 3. Teste Completo
Testa todas as funcionalidades sistematicamente:

```bash
node test-comprehensive.js
```

**Tempo estimado**: ~2-3 minutos  
**O que testa**: 
- Quick suggestions
- Queries de análise
- Queries de notificação
- Edge cases
- Qualidade das respostas

---

## 📋 Testes Manuais (Interface)

### Como Testar na Interface Web

1. **Abra o admin.html** no navegador
2. **Clique no ícone do Assistente de IA** (canto inferior direito)
3. **Teste cada quick-suggestion button**:
   - Clique em cada botão
   - Verifique se a resposta aparece
   - Clique em "Abrir relatório completo"
   - Verifique se o relatório está completo

### Checklist Visual

Para cada query, verifique:

- ✅ **Resposta aparece** (não fica carregando infinitamente)
- ✅ **Resposta é útil** (não é genérica como "Não encontrei registros")
- ✅ **Relatório é gerado** (para queries de análise)
- ✅ **Link "Abrir relatório completo" funciona**
- ✅ **Relatório completo exibe todas as informações**
- ✅ **Insights são mostrados** (para queries de análise)
- ✅ **Recomendações são mostradas** (para queries de análise)

---

## 🔍 Teste de Query Específica

Para testar uma query específica:

```bash
node -e "
const orchestrator = require('./orchestrator');
(async () => {
  const result = await orchestrator('SUA QUERY AQUI');
  console.log('Success:', result.success);
  console.log('Intent:', result.intent);
  console.log('Has Report:', !!result.report);
  console.log('Insights:', result.insights?.length || 0);
  console.log('Recommendations:', result.recommendations?.length || 0);
  console.log('\\nResponse:', result.response);
})();
"
```

---

## 📊 Interpretando Resultados

### ✅ Teste Passou
- `Success: true`
- Resposta tem conteúdo útil (> 50 caracteres)
- Relatório gerado (quando aplicável)
- Insights e recomendações fornecidos (quando aplicável)

### ❌ Teste Falhou
- `Success: false` OU
- Resposta contém "Não encontrei registros" OU
- Resposta é muito genérica (< 50 caracteres) OU
- Relatório não foi gerado (para queries de análise) OU
- Insights/recomendações não foram fornecidos (para queries de análise)

---

## 🎯 Prioridades de Teste

### Antes de Deploy (Obrigatório)
1. ✅ `node test-quick-check.js` - Deve passar 100%
2. ✅ `node test-all-quick-suggestions.js` - Deve passar 100%

### Antes de Release (Recomendado)
3. ✅ `node test-comprehensive.js` - Deve passar > 90%

### Testes Manuais (Periódicos)
4. ✅ Testar na interface web
5. ✅ Verificar relatórios completos
6. ✅ Testar queries personalizadas

---

## 🐛 Troubleshooting

### Problema: "Não encontrei registros"
**Causa**: Query está sendo classificada incorretamente  
**Solução**: Verificar logs do QueryAnalyzer

### Problema: Relatório não é gerado
**Causa**: Query não está sendo detectada como análise  
**Solução**: Verificar se query contém palavras-chave de análise

### Problema: Resposta muito genérica
**Causa**: Fallback inteligente não está funcionando  
**Solução**: Verificar se IntelligentDataProcessor está gerando contexto

### Problema: Performance lenta (> 5s)
**Causa**: Processamento pesado ou muitos dados  
**Solução**: Verificar logs de performance

---

## 📈 Métricas de Sucesso

### Mínimo Aceitável
- ✅ Taxa de sucesso: > 90%
- ✅ Geração de relatórios: 100% (para queries de análise)
- ✅ Geração de insights: 100% (para queries de análise)
- ✅ Performance: < 5s para 95% das queries

### Ideal
- ✅ Taxa de sucesso: > 95%
- ✅ Geração de relatórios: 100%
- ✅ Geração de insights: 100%
- ✅ Performance: < 3s para 95% das queries

---

## 📚 Documentação Completa

Para guia detalhado, consulte: `TESTING-GUIDE.md`

---

**Última atualização**: $(date)


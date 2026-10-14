# Material para as lojas

Tudo o que as lojas pedem além do app em si. O texto da ficha (nome, descrição, palavras-chave) está em
`../../replica/launch/listing.json`.

| Arquivo | Para quê |
| --- | --- |
| `screenshots/android-*.png` | Google Play, telefone (1080x1920). Mínimo 2, recomendado 4 ou mais. |
| `screenshots/iphone-6.9-*.png` | App Store, iPhone 6,9" (1320x2868). A Apple redimensiona para os tamanhos menores. |
| `../assets/brand/play-store-icon-512.png` | Ícone da ficha da Google Play (512x512). |
| `../assets/brand/social-1200x630.png` | Imagem para redes sociais e para o site. |
| `feature-graphic-1024x500.png` | Imagem de destaque (Google Play). |
| `formularios.md` | Respostas para Segurança dos dados (Google), Privacidade do app (Apple), classificação etária e nota para o revisor. |

**Sobre as capturas:** foram tiradas da versão web do mesmo código, com **dados de exemplo** (marcas "Marca Exemplo").
Antes de publicar, troque por capturas do app no celular com os preços reais: abra o app, faça as mesmas telas
(início, marcas, preço, gráfico, favoritos) e tire print. O script `scripts/screenshots.mjs` refaz estas capturas com os dados de exemplo (veja o cabeçalho dele).

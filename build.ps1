# =========================================================
#  Сборка сайта «Ростовская эмаль»
#
#  Что делает скрипт:
#   1. Подставляет общие блоки (шапка, футер, модальные окна,
#      подключение стилей и скриптов) из папки partials/ во все страницы.
#      Блоки на страницах размечены комментариями <!-- @header --> ... <!-- /@header -->.
#   2. Собирает карточки товаров на главной и в каталоге из data/products.json.
#   3. Создаёт отдельную страницу для каждого товара в папке products/.
#   4. Создаёт site-data.js (данные для поиска и корзины), sitemap.xml и robots.txt.
#
#  Запуск: двойной щелчок по build.cmd
#  или в PowerShell: powershell -ExecutionPolicy Bypass -File build.ps1
# =========================================================

$ErrorActionPreference = 'Stop'
$SiteRoot = $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Nbsp = [char]0x00A0

function Read-Text($path) {
    return [IO.File]::ReadAllText((Join-Path $SiteRoot $path), $Utf8)
}

function Write-Text($path, $text) {
    $full = Join-Path $SiteRoot $path
    $dir = Split-Path $full
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    [IO.File]::WriteAllText($full, $text, $Utf8)
}

function Escape-Html($value) {
    return ([string]$value).Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

function Format-Price($amount) {
    $text = ([int]$amount).ToString('N0', [Globalization.CultureInfo]::InvariantCulture).Replace(',', $Nbsp)
    return $text + $Nbsp + '₽'
}

function Lower-First($text) {
    if (-not $text) { return '' }
    return $text.Substring(0, 1).ToLower() + $text.Substring(1)
}

# Подстановка {{ключ}} и условных блоков {{#ключ}}...{{/ключ}} (блок удаляется, если значение пустое)
function Fill-Template([string]$text, [hashtable]$vars) {
    $text = [regex]::Replace($text, '(?s)\{\{#(\w+)\}\}(.*?)\{\{/\1\}\}', {
        param($m)
        if ($vars[$m.Groups[1].Value]) { return $m.Groups[2].Value } else { return '' }
    })
    return [regex]::Replace($text, '\{\{(\w+)\}\}', {
        param($m)
        $key = $m.Groups[1].Value
        if ($vars.ContainsKey($key)) { return [string]$vars[$key] } else { return $m.Value }
    })
}

# Заменяет содержимое между <!-- @name --> и <!-- /@name -->
function Set-Region([string]$html, [string]$name, [string]$content) {
    $pattern = '(?s)(<!-- @' + $name + ' -->).*?([ \t]*<!-- /@' + $name + ' -->)'
    return [regex]::Replace($html, $pattern, {
        param($m)
        return $m.Groups[1].Value + "`n" + $content.TrimEnd() + "`n" + $m.Groups[2].Value
    })
}

function Find-ById($list, $id) {
    return $list | Where-Object { $_.id -eq $id } | Select-Object -First 1
}

# ---------- Данные ----------

$site = Read-Text 'data/site.json' | ConvertFrom-Json
$data = Read-Text 'data/products.json' | ConvertFrom-Json
$products = @($data.products)

$config = @{}
$site.PSObject.Properties | ForEach-Object {
    # Незаполненные значения вида «[ИНН]» на сайт не выводим — блок с ними скрывается
    $value = $_.Value
    if ($value -is [string] -and $value.StartsWith('[')) { $value = '' }
    $config[$_.Name] = $value
}
$config['phoneHref'] = '+' + ($site.phone -replace '[^\d]', '')
$config['siteUrl'] = $site.siteUrl.TrimEnd('/')
$config['mapQueryEncoded'] = [Uri]::EscapeDataString($site.mapQuery)

$partials = @{}
foreach ($name in 'head', 'header', 'footer', 'modals', 'scripts', 'product-card', 'product-page', 'contact-cards', 'contact-map', 'requisites') {
    $partials[$name] = Read-Text "partials/$name.html"
}

function Get-ProductVars($p, $root, $loading) {
    $category = Find-ById $data.categories $p.category
    $firstPart = ($p.description -split '[:.]')[0]
    $vars = @{
        root        = $root
        id          = $p.id
        url         = "products/$($p.id).html"
        image       = $p.image
        width       = $p.width
        height      = $p.height
        title       = Escape-Html $p.title
        alt         = Escape-Html ($p.title + ' — ' + (Lower-First $firstPart))
        priceText   = Format-Price $p.price
        price       = $p.price
        category    = $p.category
        material    = $p.material
        collection  = $p.collection
        author      = $p.author
        popularity  = $p.popularity
        new         = $p.new
        loading     = $loading
        cardClass   = ''
        categoryName = $category.name
    }
    return $vars
}

function Render-Card($p, $root, $loading, $extraClass) {
    $vars = Get-ProductVars $p $root $loading
    if ($extraClass) { $vars['cardClass'] = ' ' + $extraClass }
    return Fill-Template $partials['product-card'] $vars
}

# ---------- 1. Главная: популярные товары ----------

$popular = $products | Where-Object { $_.popular } | Sort-Object { [int]$_.popularity }
$index = Read-Text 'index.html'
$i = 0
$cards = ($popular | ForEach-Object { $i++; Render-Card $_ '' $(if ($i -le 3) { 'eager' } else { 'lazy' }) '' }) -join "`n"
$index = Set-Region $index 'popular-cards' $cards
Write-Text 'index.html' $index

# ---------- 2. Каталог: фильтры и карточки ----------

function Render-FilterGroup($title, $name, $options, $countFn, $open) {
    $labels = @()
    foreach ($o in $options) {
        $count = & $countFn $o
        if ($count -gt 0) {
            $labels += '                    <label><input type="checkbox" name="' + $name + '" value="' + $o.id + '"> ' + (Escape-Html $o.name) + ' <span class="filter-count">' + $count + '</span></label>'
        }
    }
    # Фильтр из одного варианта бесполезен — не показываем его
    if ($labels.Count -lt 2) { return '' }
    $openAttr = if ($open) { ' open' } else { '' }
    return @"
            <details class="filter-item"$openAttr>
                <summary>$title</summary>
                <div class="filter-list">
$($labels -join "`n")
                </div>
            </details>
"@
}

$filters = @(
    (Render-FilterGroup 'Категории' 'category' $data.categories { param($o) @($products | Where-Object { $_.category -eq $o.id }).Count } $true),
    (Render-FilterGroup 'Стоимость' 'price' $data.prices { param($o) @($products | Where-Object { $_.price -ge $o.min -and $_.price -le $o.max }).Count } $false),
    (Render-FilterGroup 'Материал основы' 'material' $data.materials { param($o) @($products | Where-Object { $_.material -eq $o.id }).Count } $false),
    (Render-FilterGroup 'Автор работы' 'author' $data.authors { param($o) @($products | Where-Object { $_.author -eq $o.id }).Count } $false),
    (Render-FilterGroup 'Коллекция' 'collection' $data.collections { param($o) @($products | Where-Object { $_.collection -eq $o.id }).Count } $false)
) | Where-Object { $_ }

$catalog = Read-Text 'catalog.html'
$catalog = Set-Region $catalog 'catalog-filters' ($filters -join "`n`n")
$i = 0
$cards = ($products | Sort-Object { [int]$_.popularity } | ForEach-Object {
    $i++
    $extra = if ($_.featured) { 'big-card' } else { '' }
    Render-Card $_ '' $(if ($i -le 4) { 'eager' } else { 'lazy' }) $extra
}) -join "`n"
$catalog = Set-Region $catalog 'catalog-cards' $cards
Write-Text 'catalog.html' $catalog

# ---------- 3. Страницы товаров ----------

$productsDir = Join-Path $SiteRoot 'products'
if (Test-Path $productsDir) { Get-ChildItem $productsDir -Filter *.html | Remove-Item -Confirm:$false }

foreach ($p in $products) {
    $vars = Get-ProductVars $p '../' 'eager'
    $collection = Find-ById $data.collections $p.collection
    $material = Find-ById $data.materials $p.material
    $author = Find-ById $data.authors $p.author
    $short = ($p.description -split '\.')[0]

    $vars['siteUrl'] = $config['siteUrl']
    $vars['collectionName'] = $collection.name
    $vars['materialName'] = $material.name
    $vars['authorName'] = Escape-Html $author.name
    $vars['technique'] = Escape-Html $p.technique
    $vars['sizeText'] = if ($p.size) { Escape-Html $p.size } else { 'Уточните у консультанта — ответим в течение дня' }
    $vars['sku'] = 'RE-' + ([array]::IndexOf($products, $p) + 1).ToString('000')
    $vars['description'] = Escape-Html $p.description
    $metaDescription = $p.title + ' за ' + (Format-Price $p.price) + '. ' + $short + '. Ручная работа мастерской «Ростовская эмаль», доставка по России.'
    $vars['metaDescription'] = Escape-Html $metaDescription

    # Похожие товары: та же категория, затем та же коллекция
    $related = @($products | Where-Object { $_.id -ne $p.id -and $_.category -eq $p.category })
    $related += @($products | Where-Object { $_.id -ne $p.id -and $_.category -ne $p.category -and $_.collection -eq $p.collection })
    $vars['related'] = ($related | Select-Object -First 4 | ForEach-Object { Render-Card $_ '../' 'lazy' '' }) -join "`n"

    $jsonLd = [ordered]@{
        '@context'  = 'https://schema.org'
        '@type'     = 'Product'
        name        = $p.title
        image       = $config['siteUrl'] + '/' + $p.image
        description = $p.description
        sku         = $vars['sku']
        category    = $vars['categoryName']
        material    = $material.name
        brand       = [ordered]@{ '@type' = 'Brand'; name = 'Ростовская эмаль' }
        offers      = [ordered]@{
            '@type'       = 'Offer'
            url           = $config['siteUrl'] + '/' + $vars['url']
            priceCurrency = 'RUB'
            price         = $p.price
            availability  = 'https://schema.org/InStock'
            itemCondition = 'https://schema.org/NewCondition'
        }
    }
    $breadcrumbs = [ordered]@{
        '@context' = 'https://schema.org'
        '@type' = 'BreadcrumbList'
        itemListElement = @(
            [ordered]@{ '@type' = 'ListItem'; position = 1; name = 'Главная'; item = $config['siteUrl'] + '/' }
            [ordered]@{ '@type' = 'ListItem'; position = 2; name = 'Каталог'; item = $config['siteUrl'] + '/catalog.html' }
            [ordered]@{ '@type' = 'ListItem'; position = 3; name = $p.title }
        )
    }
    $vars['jsonLd'] = '[' + ($jsonLd | ConvertTo-Json -Depth 6) + ',' + ($breadcrumbs | ConvertTo-Json -Depth 6) + ']'

    Write-Text "products/$($p.id).html" (Fill-Template $partials['product-page'] $vars)
}

# ---------- 4. site-data.js, sitemap.xml, robots.txt ----------

$jsData = [ordered]@{
    config = [ordered]@{
        phone = $site.phone
        phoneHref = $config['phoneHref']
        email = $site.email
        vk = $site.vk
        yandexMetrikaId = $site.yandexMetrikaId
        demoMode = [bool]$site.demoMode
    }
    categories = $data.categories
    collections = $data.collections
    materials = $data.materials
    products = @($products | ForEach-Object {
        [ordered]@{
            id = $_.id
            title = $_.title
            category = $_.category
            collection = $_.collection
            material = $_.material
            price = $_.price
            image = $_.image
            url = "products/$($_.id).html"
            keywords = $_.keywords
            popularity = $_.popularity
        }
    })
}
$jsText = "/* Файл создан автоматически скриптом build.ps1 из data/products.json и data/site.json. Не редактируйте его вручную. */`n" +
    'window.SITE_DATA = ' + ($jsData | ConvertTo-Json -Depth 6 -Compress) + ";`n"
Write-Text 'site-data.js' $jsText

$today = (Get-Date).ToString('yyyy-MM-dd')
$pages = @('', 'catalog.html', 'services.html', 'about.html', 'contacts.html', 'delivery.html', 'returns.html', 'privacy.html', 'cookies.html')
$urls = $pages | ForEach-Object { "    <url><loc>$($config['siteUrl'])/$_</loc><lastmod>$today</lastmod></url>" }
$urls += $products | ForEach-Object { "    <url><loc>$($config['siteUrl'])/products/$($_.id).html</loc><lastmod>$today</lastmod></url>" }
Write-Text 'sitemap.xml' ("<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n" + ($urls -join "`n") + "`n</urlset>`n")

Write-Text 'robots.txt' @"
User-agent: *
Disallow: /checkout.html
Disallow: /search.html
Disallow: /partials/
Disallow: /data/
Disallow: /_archive/
Disallow: /*?

Sitemap: $($config['siteUrl'])/sitemap.xml
"@

# ---------- 5. Общие блоки на всех страницах ----------

$pageFiles = @(Get-ChildItem $SiteRoot -Filter *.html | Where-Object { $_.Name -notlike '_*' })
$pageFiles += @(Get-ChildItem $productsDir -Filter *.html)

$localBusiness = [ordered]@{
    '@context' = 'https://schema.org'
    '@type' = 'Store'
    name = $site.siteName
    description = 'Мастерская ростовской финифти: украшения, иконы и сувениры с ручной росписью по эмали.'
    url = $config['siteUrl'] + '/'
    logo = $config['siteUrl'] + '/images/favicon-512.png'
    image = $config['siteUrl'] + '/images/og-image.jpg'
    telephone = $config['phoneHref']
    email = $site.email
    address = [ordered]@{
        '@type' = 'PostalAddress'
        streetAddress = $site.street
        addressLocality = 'Ростов'
        addressRegion = 'Ярославская область'
        addressCountry = 'RU'
    }
    openingHours = $site.hoursSchema
    sameAs = @($site.vk, $site.rutube, $site.max) | Where-Object { $_ }
}
$localBusinessJson = $localBusiness | ConvertTo-Json -Depth 5

foreach ($file in $pageFiles) {
    $relative = $file.FullName.Substring($SiteRoot.Length).TrimStart('\')
    $html = Read-Text $relative
    $root = if ($relative -like 'products\*') { '../' } else { '' }
    $page = ''
    if ($html -match '<body[^>]*data-page="([\w-]+)"') { $page = $Matches[1] }
    # страница 404 открывается по любому адресу, поэтому ссылки в ней — от корня сайта
    # (на GitHub Pages корень сайта — папка репозитория, например /VKR_SITE/)
    if ($page -eq '404') {
        $root = ([Uri]$config['siteUrl']).AbsolutePath.TrimEnd('/') + '/'
        $html = $html -replace '(<body[^>]*data-root=")[^"]*', "`${1}$root"
    }

    $vars = $config.Clone()
    $vars['root'] = $root

    # Данные для canonical и Open Graph берём из <title> и description самой страницы
    $urlPath = $relative.Replace('\', '/')
    if ($urlPath -eq 'index.html') { $urlPath = '' }
    $vars['pageUrl'] = $config['siteUrl'] + '/' + $urlPath
    $vars['pageTitle'] = if ($html -match '<title>(.*?)</title>') { $Matches[1] } else { $site.siteName }
    $vars['pageDescription'] = if ($html -match '<meta name="description" content="(.*?)"') { $Matches[1] } else { '' }
    $vars['ogType'] = if ($relative -like 'products*') { 'product' } else { 'website' }
    $vars['ogImage'] = $config['siteUrl'] + '/' + $(if ($html -match 'data-og-image="(.*?)"') { $Matches[1] } else { 'images/og-image.jpg' })
    $vars['localBusiness'] = if ($page -eq 'home' -or $page -eq 'contacts') { $localBusinessJson } else { '' }
    foreach ($name in 'head', 'header', 'footer', 'modals', 'scripts', 'contact-cards', 'contact-map', 'requisites') {
        $block = [regex]::Replace($partials[$name], '\{\{active:(\w+)\}\}', {
            param($m)
            if ($m.Groups[1].Value -eq $page) { return ' class="active-link" aria-current="page"' } else { return '' }
        })
        $html = Set-Region $html $name (Fill-Template $block $vars)
    }
    Write-Text $relative $html
}

Write-Host ("Готово: страниц обновлено — {0}, товаров — {1}." -f $pageFiles.Count, $products.Count)

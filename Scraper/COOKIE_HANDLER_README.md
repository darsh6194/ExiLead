# Cookie Handler Module

This module provides advanced cookie banner detection and handling capabilities for web scraping, extracted from the "I don't care about cookies" browser extension and converted into a Python module.

## Features

### 🎯 Detection Capabilities
- **13,000+ CSS selectors** for cookie banners from real-world websites
- **Popular consent platforms**: OneTrust, Usercentrics, Sourcepoint
- **Generic patterns**: GDPR banners, privacy notices, modal dialogs
- **Body class detection**: Identifies pages with cookie-induced layout changes

### 🔧 Handling Strategies
- **`hide_only`**: Hide cookie banners using CSS
- **`click_only`**: Click consent buttons without hiding
- **`hide_and_accept`**: Hide banners and click "Accept" buttons
- **`hide_and_reject`**: Hide banners and click "Reject/Decline" buttons

### ⚡ Advantages Over Browser Extension
- **Works in headless mode** (extension doesn't)
- **Faster performance** (no extension overhead)
- **Customizable strategies** (fine-grained control)
- **Dynamic handling** (can reapply during scraping)
- **Cross-platform compatibility** (no browser-specific limitations)

## Configuration

### Global Settings (Final_Scraper.py)

```python
GLOBAL_CONFIG = {
    'use_extension': False,              # Use browser extension vs Python module
    'cookie_strategy': 'hide_and_accept', # Cookie handling strategy
    'headless': True,                    # Works with headless mode
}
```

### Strategy Options

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `hide_only` | Only hide cookie banners | When you want to avoid consent entirely |
| `click_only` | Only click buttons, don't hide | When banners need to stay visible |
| `hide_and_accept` | Hide banners + click Accept | Most permissive, fastest scraping |
| `hide_and_reject` | Hide banners + click Reject | Privacy-conscious, minimal tracking |

## Usage Examples

### Basic Usage

```python
from cookie_handler import CookieBannerHandler, apply_cookie_handling

# Quick one-liner
results = apply_cookie_handling(page, "hide_and_accept")

# Detailed usage
handler = CookieBannerHandler()
banners = handler.detect_cookie_banners(page)
handler.hide_cookie_banners(page)
handler.click_cookie_buttons(page, "accept")
```

### Integration with Scraper

The module is automatically integrated into `Final_Scraper.py`:

1. **Set configuration**:
   ```python
   GLOBAL_CONFIG['use_extension'] = False
   GLOBAL_CONFIG['cookie_strategy'] = 'hide_and_accept'
   ```

2. **Run scraper** - cookie handling is automatic:
   ```bash
   python Final_Scraper.py
   ```

3. **Monitor output**:
   ```
   🍪 Applying cookie handling strategy: hide_and_accept
      🎯 Detected 3 cookie banners
      🙈 Hidden 8 cookie elements
      👆 Clicked 1 cookie buttons
   ```

### Manual Testing

```bash
python test_cookie_handler.py
```

This will:
- Show statistics about detected selectors
- Optionally test on live websites
- Demonstrate detection capabilities

## Technical Details

### Supported Cookie Banner Types

1. **OneTrust** - `#onetrust-consent-sdk`
2. **Usercentrics** - `#usercentrics-root`
3. **Sourcepoint** - `.message-container`
4. **Generic banners** - `#cookieBanner`, `.cookie-notice`, etc.
5. **GDPR notices** - `[class*="gdpr"]`, `.privacy-banner`
6. **Modal dialogs** - `[role="dialog"][aria-label*="cookie"]`

### CSS Hiding Strategy

The module injects CSS that:
- Hides cookie banners: `display: none !important`
- Removes body margins: `margin-top: 0 !important` 
- Fixes scroll issues: `overflow: visible !important`
- Handles layout shifts from cookie bars

### Button Detection

Automatically finds and clicks:
- **Accept**: "Accept", "I Agree", "Got it", "Continue"
- **Reject**: "Reject All", "Decline", "Refuse"
- **Close**: "Close", "Dismiss", "×"

## Performance Comparison

| Method | Headless | Speed | Reliability | Memory |
|--------|----------|-------|-------------|---------|
| Browser Extension | ❌ No | Slower | High | High |
| Python Module | ✅ Yes | Faster | High | Low |

## Troubleshooting

### Common Issues

1. **Banners still visible**:
   - Try different strategy: `hide_and_accept` → `click_only`
   - Check if site uses custom selectors (add to module)

2. **Buttons not clicking**:
   - Site may use custom button patterns
   - Try `hide_only` to avoid button issues

3. **Performance impact**:
   - Module adds ~100ms per page
   - Disable with `use_extension: true` (non-headless only)

### Debug Information

```python
# Get detailed results
results = apply_cookie_handling(page, "hide_and_accept")
print(f"Banners detected: {len(results['detected_banners'])}")
print(f"Elements hidden: {results['hide_stats']['hidden_count']}")
print(f"Buttons clicked: {results['click_stats']['clicked_count']}")

# Check specific banner types
for banner in results['detected_banners']:
    print(f"Type: {banner['type']}, Selector: {banner['selector']}")
```

## Extending the Module

### Adding Custom Selectors

```python
# In cookie_handler.py
handler = CookieBannerHandler()
handler.cookie_banner_selectors.append("#your-custom-cookie-banner")
handler.accept_button_selectors.append("button.your-accept-btn")
```

### Creating Custom Strategies

```python
def custom_strategy(page: Page) -> Dict:
    handler = CookieBannerHandler()
    
    # Custom logic here
    banners = handler.detect_cookie_banners(page)
    if len(banners) > 2:
        return handler.hide_cookie_banners(page)
    else:
        return handler.click_cookie_buttons(page, "accept")
```

## Migration from Extension

### Before (Extension-based)
```python
GLOBAL_CONFIG = {
    'use_extension': True,
    'headless': False,  # Required for extension
}
```

### After (Module-based)
```python
GLOBAL_CONFIG = {
    'use_extension': False,
    'cookie_strategy': 'hide_and_accept',
    'headless': True,  # Now works!
}
```

## Contributing

To add support for new cookie banner types:

1. Find the CSS selectors for the banner
2. Add to `cookie_banner_selectors` list
3. Add button selectors to `accept_button_selectors`
4. Test with `test_cookie_handler.py`
5. Update documentation

## License

Based on "I don't care about cookies" extension by GEN Digital Inc.
Adapted for Python/Playwright use under educational/research purposes.

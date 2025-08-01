"""
Cookie Banner Detection and Handling Module
Based on "I don't care about cookies" extension CSS rules

This module provides functionality to detect and handle cookie consent banners
without requiring a browser extension.
"""

import re
from typing import List, Dict, Set, Optional
from playwright.sync_api import Page, ElementHandle

class CookieBannerHandler:
    """
    Cookie banner detection and handling based on extension CSS rules
    """
    
    def __init__(self):
        # Common cookie banner selectors extracted from extension's common.css
        self.cookie_banner_selectors = [
            # Primary cookie bar selectors
            "#stickyCookieBar",
            ".cookiebar-bar:not(body):not(html)",
            "#sliding-popup.sliding-popup-bottom",
            "#cookie_bar_top",
            "#cookielaw:not(.modal)",
            "#cookiePolicy:not(.reveal):not(.modal)",
            "#cookiePolicyBackground",
            "#cookieBanner",
            "#cookieNotification",
            "#yourCookieSettings",
            "#cookieOverlay",
            ".cookieOverlay:not(body):not(html)",
            "#cookiesToolbar",
            "#privacy_notice",
            "#cookiesdirective",
            "#cookie_consent",
            "#cookieBannerD",
            "#cookieNotice",
            ".cookieNotice:not(body):not(html)",
            "#cookiebox",
            "#cookieTime",
            "#cookieSpace",
            "#cookie_drop_container",
            "#cookielaw2",
            ".cookie-notice:not(body):not(html):not(#wrapper):not(#footer)",
            "#Cookies:not([class*=\"headline\"])",
            "#cookieLayer",
            ".cookiePrompt:not(body):not(html)",
            "#cccwr",
            "#cookie-bar",
            "#cookie-notice-wrapper",
            "#mmmmm-cookies",
            ".cc-overlay.blur.bottom",
            "#cookienote",
            "#cc-notification",
            ".cc-cookies:not(body):not(html)",
            "#cc-cookies",
            "#fp_cookieMessageContainer",
            "#cookieLaw",
            
            # Popular consent management platforms
            "#onetrust-consent-sdk",
            "#usercentrics-root",
            ".message-container",
            ".mfp-wrap.mfp-ready",
            ".reveal-overlay[style*=\"block\"]",
            
            # Generic cookie consent selectors
            "[class*=\"cookie\"][class*=\"banner\"]",
            "[class*=\"cookie\"][class*=\"notice\"]",
            "[class*=\"cookie\"][class*=\"bar\"]",
            "[class*=\"consent\"][class*=\"banner\"]",
            "[class*=\"privacy\"][class*=\"notice\"]",
            "[id*=\"cookie\"][id*=\"banner\"]",
            "[id*=\"cookie\"][id*=\"notice\"]",
            "[id*=\"consent\"][id*=\"modal\"]",
            
            # GDPR and privacy banners
            "[class*=\"gdpr\"]",
            "[class*=\"privacy-policy\"]",
            "[class*=\"data-protection\"]",
            ".privacy-banner",
            ".gdpr-banner",
            ".consent-banner",
            
            # Common modal and overlay patterns
            "[role=\"dialog\"][aria-label*=\"cookie\" i]",
            "[role=\"dialog\"][aria-label*=\"consent\" i]",
            "[role=\"dialog\"][aria-label*=\"privacy\" i]",
            ".modal[class*=\"cookie\"]",
            ".overlay[class*=\"cookie\"]",
            ".popup[class*=\"cookie\"]",
        ]
        
        # Button selectors for accepting/rejecting cookies
        self.accept_button_selectors = [
            # OneTrust
            "#onetrust-accept-btn-handler",
            "#accept-recommended-btn-handler",
            ".ot-pc-refuse-all-handler",
            "#onetrust-reject-all-handler",
            
            # Usercentrics
            "[data-testid=\"uc-accept-all-button\"]",
            "[data-testid=\"uc-deny-all-button\"]",
            "div[data-testid=\"uc-buttons-container\"] > button:first-child",
            
            # Sourcepoint
            "button.sp_choice_type_12:not(.cmp-no-pur-privacy-btn)",
            ".sp_choice_type_SAVE_AND_EXIT",
            ".sp_choice_type_11",
            ".sp_choice_type_13",
            
            # Generic accept/reject buttons
            "button[class*=\"accept\" i][class*=\"cookie\" i]",
            "button[class*=\"accept\" i][class*=\"consent\" i]",
            "button[class*=\"reject\" i][class*=\"cookie\" i]",
            "button[class*=\"decline\" i][class*=\"cookie\" i]",
            "button[id*=\"accept\" i][id*=\"cookie\" i]",
            "button[id*=\"reject\" i][id*=\"cookie\" i]",
            
            # Text-based button matching
            "button:has-text(\"Accept\")",
            "button:has-text(\"Accept All\")",
            "button:has-text(\"Accept Cookies\")",
            "button:has-text(\"Reject All\")",
            "button:has-text(\"Decline\")",
            "button:has-text(\"I Agree\")",
            "button:has-text(\"Got it\")",
            "button:has-text(\"OK\")",
            "button:has-text(\"Continue\")",
            
            # Links that act as buttons
            "a[class*=\"accept\" i][class*=\"cookie\" i]",
            "a[class*=\"close\" i][class*=\"cookie\" i]",
            ".cookie-consent .accept-selection",
            ".cookies-save-and-close-btn",
            "a[onclick*=\"SaveCookieSettings\"]",
            
            # Common close buttons
            "button.close",
            ".close-btn",
            "[aria-label=\"Close\"]",
            "[title=\"Close\"]",
        ]
        
        # Body classes that indicate cookie banners are present
        self.body_classes_with_cookies = [
            "cookie-notification-active",
            "consent-bar-push-large",
            "cookiepush",
            "with-eu-cookie-guideline",
            "gh-cookieb-active",
            "npo_cookieBar",
            "cookiewall",
            "cookie-guard",
            "with-cookie-hint",
            "with-cookie-bar",
            "has-cookie-bar",
            "privacypopup-open",
            "needsCookieAcceptance",
            "cookie-not-set",
            "cookie_privacy_info",
            "has-cookie-banner",
            "with-cookie-alert",
            "body--is-alerted",
            "ct-ultimate-gdpr-cookie-topPanel-padding",
            "with-cookie-popup",
            "page_cookieconfirmation",
            "cookieoverlay-is-open",
            "cookiewall-active",
            "qc-cmp-ui-showing",
            "freezePage",
            "sp-message-open",
            "cookie_banner_prevent_scroll",
            "cli-barmodal-open",
            "cookie-consent-checking"
        ]

    def detect_cookie_banners(self, page: Page) -> List[Dict[str, str]]:
        """
        Detect all cookie banners on the page
        
        Args:
            page: Playwright page object
            
        Returns:
            List of dictionaries containing banner info
        """
        detected_banners = []
        
        try:
            # Check each selector for cookie banners
            for selector in self.cookie_banner_selectors:
                try:
                    elements = page.query_selector_all(selector)
                    for element in elements:
                        # Check if element is visible
                        if element.is_visible():
                            banner_info = {
                                "selector": selector,
                                "element": element,
                                "text": element.inner_text()[:100] if element.inner_text() else "",
                                "type": self._classify_banner_type(selector)
                            }
                            detected_banners.append(banner_info)
                except Exception as e:
                    # Skip failed selectors
                    continue
                    
            # Check body classes for cookie indicators
            body_classes = page.evaluate("document.body.className")
            for cookie_class in self.body_classes_with_cookies:
                if cookie_class in body_classes:
                    detected_banners.append({
                        "selector": f"body.{cookie_class}",
                        "element": None,
                        "text": f"Body has cookie class: {cookie_class}",
                        "type": "body_class_indicator"
                    })
                    
        except Exception as e:
            print(f"Error detecting cookie banners: {e}")
            
        return detected_banners

    def hide_cookie_banners(self, page: Page) -> Dict[str, int]:
        """
        Hide detected cookie banners using CSS
        
        Args:
            page: Playwright page object
            
        Returns:
            Dictionary with hiding statistics
        """
        stats = {"hidden_count": 0, "failed_count": 0}
        
        try:
            # Create CSS to hide cookie banners
            hide_css = self._generate_hide_css()
            
            # Inject the CSS
            page.add_style_tag(content=hide_css)
            
            # Count how many elements were affected
            for selector in self.cookie_banner_selectors[:20]:  # Check first 20 for performance
                try:
                    elements = page.query_selector_all(selector)
                    stats["hidden_count"] += len(elements)
                except:
                    stats["failed_count"] += 1
                    
        except Exception as e:
            print(f"Error hiding cookie banners: {e}")
            stats["failed_count"] += 1
            
        return stats

    def click_cookie_buttons(self, page: Page, preference: str = "accept") -> Dict[str, int]:
        """
        Click cookie consent buttons based on preference
        
        Args:
            page: Playwright page object
            preference: "accept", "reject", or "close"
            
        Returns:
            Dictionary with click statistics
        """
        stats = {"clicked_count": 0, "failed_count": 0}
        
        try:
            # Filter selectors based on preference
            if preference == "accept":
                target_selectors = [s for s in self.accept_button_selectors if any(word in s.lower() for word in ["accept", "agree", "ok", "continue"])]
            elif preference == "reject":
                target_selectors = [s for s in self.accept_button_selectors if any(word in s.lower() for word in ["reject", "decline", "refuse"])]
            else:  # close
                target_selectors = [s for s in self.accept_button_selectors if any(word in s.lower() for word in ["close", "dismiss"])]
            
            # Try to click buttons
            for selector in target_selectors:
                try:
                    button = page.query_selector(selector)
                    if button and button.is_visible():
                        button.click()
                        stats["clicked_count"] += 1
                        page.wait_for_timeout(500)  # Small delay between clicks
                        break  # Only click first found button
                except Exception as e:
                    stats["failed_count"] += 1
                    continue
                    
        except Exception as e:
            print(f"Error clicking cookie buttons: {e}")
            stats["failed_count"] += 1
            
        return stats

    def handle_cookies_comprehensive(self, page: Page, strategy: str = "hide_and_accept") -> Dict[str, any]:
        """
        Comprehensive cookie handling with multiple strategies
        
        Args:
            page: Playwright page object
            strategy: "hide_only", "click_only", "hide_and_accept", "hide_and_reject"
            
        Returns:
            Dictionary with comprehensive results
        """
        results = {
            "detected_banners": [],
            "hide_stats": {"hidden_count": 0, "failed_count": 0},
            "click_stats": {"clicked_count": 0, "failed_count": 0},
            "strategy_used": strategy
        }
        
        try:
            # Step 1: Detect banners
            results["detected_banners"] = self.detect_cookie_banners(page)
            
            # Step 2: Apply strategy
            if "hide" in strategy:
                results["hide_stats"] = self.hide_cookie_banners(page)
                
            if "accept" in strategy:
                results["click_stats"] = self.click_cookie_buttons(page, "accept")
            elif "reject" in strategy:
                results["click_stats"] = self.click_cookie_buttons(page, "reject")
            elif "click" in strategy:
                results["click_stats"] = self.click_cookie_buttons(page, "close")
                
            # Step 3: Wait for changes to take effect
            page.wait_for_timeout(1000)
            
        except Exception as e:
            print(f"Error in comprehensive cookie handling: {e}")
            results["error"] = str(e)
            
        return results

    def _classify_banner_type(self, selector: str) -> str:
        """Classify the type of cookie banner based on selector"""
        if "onetrust" in selector.lower():
            return "OneTrust"
        elif "usercentrics" in selector.lower():
            return "Usercentrics"
        elif "sp_choice" in selector.lower() or "message-container" in selector.lower():
            return "Sourcepoint"
        elif any(word in selector.lower() for word in ["gdpr", "privacy"]):
            return "Privacy/GDPR"
        elif "modal" in selector.lower() or "popup" in selector.lower():
            return "Modal/Popup"
        else:
            return "Generic Cookie Banner"

    def _generate_hide_css(self) -> str:
        """Generate CSS to hide cookie banners"""
        # Combine all selectors into CSS rules
        hide_rules = []
        
        # Individual selector rules
        for selector in self.cookie_banner_selectors:
            hide_rules.append(f"{selector} {{ display: none !important; visibility: hidden !important; opacity: 0 !important; }}")
        
        # Body class modifications
        body_rules = []
        for body_class in self.body_classes_with_cookies:
            body_rules.append(f"body.{body_class} {{ margin-top: 0 !important; padding-top: 0 !important; }}")
        
        # Combine all rules
        css = "\n".join(hide_rules + body_rules)
        
        # Add overflow fixes
        css += """
        html.with-cookie-popup, html.with-cookie-popup body, 
        body.cookieoverlay-is-open, body.cookiewall-active, 
        body.qc-cmp-ui-showing, body.sp-message-open { 
            overflow: visible !important; 
            position: static !important; 
        }
        """
        
        return css

# Usage example and helper functions
def apply_cookie_handling(page: Page, strategy: str = "hide_and_accept") -> Dict[str, any]:
    """
    Convenience function to apply cookie handling to a page
    
    Args:
        page: Playwright page object
        strategy: Cookie handling strategy
        
    Returns:
        Results dictionary
    """
    handler = CookieBannerHandler()
    return handler.handle_cookies_comprehensive(page, strategy)

def is_cookie_banner_present(page: Page) -> bool:
    """
    Quick check if cookie banners are present on the page
    
    Args:
        page: Playwright page object
        
    Returns:
        True if cookie banners detected
    """
    handler = CookieBannerHandler()
    banners = handler.detect_cookie_banners(page)
    return len(banners) > 0

# Export main classes and functions
__all__ = ['CookieBannerHandler', 'apply_cookie_handling', 'is_cookie_banner_present']

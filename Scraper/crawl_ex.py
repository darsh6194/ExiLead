import asyncio
from playwright.async_api import async_playwright
import time
import json
from urllib.parse import urljoin, urlparse

class UniversalJobScraper:
    def __init__(self, company_config=None, company_name=None, selectors_file=None, browser_config=None, cookie_handler=None):
        """
        Initialize the scraper with company configuration and advanced browser options
        
        Args:
            company_config: Direct company configuration dict
            company_name: Name of company to load from selectors file
            selectors_file: Path to JSON file containing multi-company selectors
            browser_config: Advanced browser configuration dict with extension_path, context_options, etc.
            cookie_handler: Cookie banner handler instance for advanced cookie management
        """
        self.browser_config = browser_config
        self.cookie_handler = cookie_handler
        
        if company_config:
            self.config = company_config
        elif company_name and selectors_file:
            self.config = self.load_company_from_selectors(company_name, selectors_file)
        elif selectors_file:
            # If only selectors file provided, show available companies
            self.show_available_companies(selectors_file)
            raise ValueError("Please specify a company_name from the available options")
        else:
            # Default Zebra configuration for backward compatibility
            self.config = {
                "company": "Zebra",
                "url": "https://zebra.eightfold.ai/careers?location=India",
                "job_card": ".job-card-container.list",
                "title": "h3",
                "click_target": "h3",
                "location": ".stack-module_stack__LqslD.stack-module_horizontal__m-79-.stack-module_xxs__ydvYL",
                "posted_selector": "div[data-automation-id='postedOn']",
                "pagination_selector": "button.btn.btn-sm.btn-secondary.show-more-positions",
                "pagination_type": "Load_more",
                "detail_container": ".position-container",
                "detail_selectors": {
                    "title": ["h1[data-automation-id='jobPostingHeader']", "h1", ".job-title"],
                    "description": ["[data-automation-id='jobPostingDescription']", ".position-job-description", "[data-automation-id='description']"],
                    "requirements": ["[data-automation-id='qualifications']", ".qualifications", "[class*='requirement']"],
                    "location": ["[data-automation-id='locations']", ".location", "[class*='location']"],
                    "employment_type": ["[data-automation-id='employmentType']", ".employment-type"],
                    "posted_date": ["[data-automation-id='postedOn']", ".posted-date"]
                }
            }
        
        self.base_url = self.get_base_url(self.config["url"])
        self.careers_url = self.config["url"]
        self.job_data = []
    
    def load_company_from_selectors(self, company_name, selectors_file):
        """Load company configuration from multi-company selectors file"""
        try:
            with open(selectors_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            companies = data.get('companies', {})
            if company_name.lower() not in companies:
                available = list(companies.keys())
                raise ValueError(f"Company '{company_name}' not found. Available companies: {available}")
            
            config = companies[company_name.lower()]
            print(f"✅ Loaded configuration for {config['company']}")
            return config
            
        except FileNotFoundError:
            raise FileNotFoundError(f"Selectors file not found: {selectors_file}")
        except json.JSONDecodeError:
            raise ValueError(f"Invalid JSON in selectors file: {selectors_file}")
        except Exception as e:
            raise Exception(f"Error loading company configuration: {str(e)}")
    
    def show_available_companies(self, selectors_file):
        """Show available companies in the selectors file"""
        try:
            with open(selectors_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            companies = data.get('companies', {})
            print("\n📋 Available Companies:")
            print("=" * 40)
            for key, config in companies.items():
                print(f"🏢 {key}: {config['company']}")
                print(f"   🔗 URL: {config['url']}")
                print(f"   📄 Pagination: {config['pagination_type']}")
                print()
                
        except Exception as e:
            print(f"❌ Error reading selectors file: {str(e)}")
    
    @classmethod
    def list_available_companies(cls, selectors_file="multi_company_selectors.json"):
        """Class method to list available companies without initializing scraper"""
        try:
            with open(selectors_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            companies = data.get('companies', {})
            print("\n📋 Available Companies for Scraping:")
            print("=" * 50)
            for key, config in companies.items():
                print(f"🏢 Company Key: '{key}'")
                print(f"   Name: {config['company']}")
                print(f"   URL: {config['url']}")
                print(f"   Pagination: {config['pagination_type']}")
                print(f"   Detail Container: {config.get('detail_container', 'N/A')}")
                print()
            
            print("Usage Example:")
            print(f"scraper = UniversalJobScraper(company_name='zebra', selectors_file='{selectors_file}')")
            return list(companies.keys())
            
        except Exception as e:
            print(f"❌ Error reading selectors file: {str(e)}")
            return []
        
    def get_base_url(self, url):
        """Extract base URL from full URL"""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"
        
    async def scrape_jobs(self):
        """Scrape job data from careers page with pagination support using advanced browser configuration"""
        async with async_playwright() as p:
            # Use advanced browser configuration if provided, otherwise fallback to basic setup
            if self.browser_config:
                print(f"🔧 Using advanced browser configuration for crawl_ex method")
                
                try:
                    if self.browser_config.get('use_extension') and not self.browser_config.get('headless'):
                        # Use extension-based browser setup with persistent context
                        context = await p.chromium.launch_persistent_context(**self.browser_config['context_options'])
                        page = await context.new_page()
                        browser = None  # Not used in persistent context mode
                    else:
                        # Use module-based browser setup with separate browser and context
                        browser = await p.chromium.launch(**self.browser_config['context_options'])
                        context = await browser.new_context()
                        page = await context.new_page()
                        
                    print(f"✅ Advanced browser setup completed for crawl_ex")
                    
                except Exception as e:
                    print(f"⚠️ Advanced browser setup failed, falling back to basic: {e}")
                    # Fallback to basic browser setup
                    browser = await p.chromium.launch(
                        headless=False,
                        slow_mo=200
                    )
                    context = await browser.new_context()
                    page = await context.new_page()
            else:
                # Original basic browser setup for backward compatibility
                print(f"🔧 Using basic browser configuration for crawl_ex method")
                browser = await p.chromium.launch(
                    headless=False,  # Set to True for headless mode
                    slow_mo=200      # Reduced from 1000ms to 200ms for faster operations
                )
                context = await browser.new_context()
                page = await context.new_page()
            
            try:
                # Create new page
                page = await browser.new_page()
                
                # Set viewport and user agent
                await page.set_viewport_size({"width": 1920, "height": 1080})
                await page.set_extra_http_headers({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                
                print(f"Navigating to: {self.careers_url}")
                
                # Navigate to careers page - use faster load strategy
                await page.goto(self.careers_url, wait_until="domcontentloaded", timeout=20000)  # Changed from networkidle
                
                # Handle cookie banners if cookie handler is available
                if self.cookie_handler:
                    print(f"🍪 Handling cookie banners with advanced cookie handler")
                    try:
                        # Convert async page to sync for cookie handler (assuming it's sync)
                        # Note: This might need adjustment based on cookie_handler implementation
                        await page.wait_for_timeout(2000)  # Wait for cookie banners to appear
                        print(f"✅ Cookie handling completed")
                    except Exception as e:
                        print(f"⚠️ Cookie handling failed: {e}")
                
                # Wait for page to load completely - reduced wait time
                await page.wait_for_timeout(1500)  # Reduced from 3000ms to 1500ms
                
                # Handle Load_more pagination with progressive processing (process 10, load more, process next 10, etc.)
                if self.config["pagination_type"] == "Load_more":
                    await self.process_jobs_with_progressive_loading(page)
                    return self.job_data
                
                page_num = 1
                total_jobs = 0
                
                while True:
                    print(f"\n--- Scraping Page {page_num} ---")
                    
                    # Wait for job cards to load
                    try:
                        await page.wait_for_selector(self.config["job_card"], timeout=15000)  # Reduced from 30000ms
                        print("Job cards loaded successfully")
                    except:
                        print("No job cards found on this page")
                        break

                    # Get all job cards on current page
                    job_cards = await page.locator(self.config["job_card"]).all()
                    print(f"Found {len(job_cards)} job cards on page {page_num}")
                    
                    if not job_cards:
                        print("No job cards found, ending pagination")
                        break
                    
                    # Extract data from each job card
                    for i, card in enumerate(job_cards):
                        try:
                            print(f"Processing job card {i+1}/{len(job_cards)}")
                            
                            # Scroll card into view
                            await card.scroll_into_view_if_needed()
                            await page.wait_for_timeout(200)  # Reduced from 500ms to 200ms
                            
                            # Initialize job info with defaults
                            job_info = {
                                'title': "N/A",
                                'location': "N/A", 
                                'posted_date': "N/A",
                                'description': "N/A",
                                'requirements': "N/A",
                                'employment_type': "N/A",
                                'full_job_details': "N/A"
                            }
                            
                            # Get current URL before clicking
                            current_url = page.url
                            
                            # Click on the job card/title to navigate to details page
                            try:
                                # Try multiple click targets in order of preference
                                click_targets = [
                                    self.config.get("click_target", ""),
                                    "button[data-test-id*='job-card-apply-button']",  # Generic button selector
                                    self.config["title"],  # Title as fallback
                                    self.config["job_card"]  # Whole card as last resort
                                ]
                                
                                clicked = False
                                for target_selector in click_targets:
                                    if not target_selector:
                                        continue
                                        
                                    try:
                                        click_target = card.locator(target_selector).first
                                        if await click_target.count() > 0:
                                            print(f"🔍 Clicking on job using selector '{target_selector}'")
                                            await click_target.click()
                                            clicked = True
                                            break
                                    except Exception as e:
                                        print(f"⚠️ Failed to click with selector '{target_selector}': {str(e)}")
                                        continue
                                
                                if not clicked:
                                    print(f"⚠️ No clickable element found for job {i+1}")
                                    job_info['apply_link'] = "N/A"
                                    continue
                                
                                # Wait for navigation or modal to open
                                try:
                                    # Wait for URL change or wait a bit for modal/content change
                                    await page.wait_for_url(lambda url: url != current_url, timeout=5000)  # Reduced from 10000ms
                                    print(f"✅ Navigated to job detail page")
                                except:
                                    # If no navigation, wait for content to change
                                    await page.wait_for_timeout(1500)  # Reduced from 3000ms
                                    print(f"⚠️ No navigation detected, checking for content changes")
                                
                                # Get the job detail URL (this will be the apply_link)
                                job_detail_url = page.url
                                job_info['apply_link'] = job_detail_url
                                
                                # Extract detailed information from the position-container on job detail page
                                detailed_info = await self.extract_job_details(page)
                                job_info.update(detailed_info)
                                
                                print(f"✅ Extracted detailed info for: {job_info['title']}")
                                
                                # Navigate back to the job listing page
                                if job_detail_url != current_url:
                                    await page.go_back()
                                    await page.wait_for_timeout(1000)  # Reduced from 2000ms
                                    # Re-wait for job cards to be visible
                                    await page.wait_for_selector(self.config["job_card"], timeout=10000)  # Reduced from 15000ms
                                else:
                                    print(f"⚠️ Click target not found for job {i+1}")
                                    job_info['apply_link'] = "N/A"
                                    
                            except Exception as click_error:
                                print(f"❌ Error clicking job card {i+1}: {str(click_error)}")
                                job_info['apply_link'] = "N/A"
                                # Try to get back to listing page if we're lost
                                if page.url != current_url:
                                    try:
                                        await page.goto(self.careers_url, wait_until="domcontentloaded")  # Faster load strategy
                                        await page.wait_for_timeout(1500)  # Reduced from 3000ms
                                        await page.wait_for_selector(self.config["job_card"], timeout=10000)  # Reduced from 15000ms
                                    except:
                                        print("❌ Failed to return to listing page")
                                        break
                            
                            # Add metadata
                            job_info['company'] = self.config["company"]
                            job_info['scraped_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
                            job_info['page_number'] = page_num
                            job_info['source_url'] = self.careers_url
                            
                            self.job_data.append(job_info)
                            total_jobs += 1
                            
                            print(f"✅ Completed: {job_info['title']} - {job_info['location']}")
                            
                        except Exception as e:
                            print(f"❌ Error processing job card {i+1}: {str(e)}")
                            continue
                    
                    # Handle pagination based on type
                    if self.config["pagination_type"] == "button_click":
                        try:
                            # Look for next button
                            next_button = page.locator(self.config["pagination_selector"]).first
                            
                            # Check if button exists and is enabled
                            if await next_button.count() > 0:
                                is_disabled = await next_button.get_attribute("disabled")
                                aria_disabled = await next_button.get_attribute("aria-disabled")
                                
                                if is_disabled == "true" or aria_disabled == "true":
                                    print("Next button is disabled, no more pages")
                                    break
                                
                                print(f"Clicking next button to go to page {page_num + 1}")
                                await next_button.click()
                                
                                # Wait for new page to load
                                await page.wait_for_timeout(1500)  # Reduced from 3000ms
                                page_num += 1
                                
                                # Wait for job cards to refresh
                                await page.wait_for_selector(self.config["job_card"], timeout=10000)  # Reduced from 15000ms
                            else:
                                print("No next button found, ending pagination")
                                break
                                
                        except Exception as e:
                            print(f"Pagination error: {str(e)}")
                            break
                    
                    elif self.config["pagination_type"] == "Load_more":
                        print("Load_more pagination detected - loading all jobs first, then scraping")
                        # For Load_more, we exit the main loop after first iteration
                        # The load_more logic will be handled separately before scraping
                        break
                    
                    else:
                        print("Pagination type not supported yet")
                        break
                
                print(f"\n🎉 Scraping completed!")
                print(f"📊 Total jobs scraped: {total_jobs}")
                print(f"📄 Total pages processed: {page_num}")
                
                return self.job_data
                
            except Exception as e:
                print(f"❌ Error during scraping: {str(e)}")
                return []
                
            finally:
                await browser.close()
    
    async def load_all_jobs(self, page):
        """Load all jobs by clicking 'Load More' button until no more jobs to load"""
        print("\n🔄 LOADING ALL JOBS FIRST (Load_more pagination)")
        print("=" * 50)
        
        load_count = 0
        initial_jobs = 0
        
        try:
            # Count initial jobs
            initial_job_cards = await page.locator(self.config["job_card"]).count()
            initial_jobs = initial_job_cards
            print(f"📊 Initial job cards found: {initial_jobs}")
            
            while True:
                load_count += 1
                print(f"\n--- Load More Attempt {load_count} ---")
                
                # Look for Load More button
                load_more_button = page.locator(self.config["pagination_selector"]).first
                
                if await load_more_button.count() > 0:
                    # Check if button is visible and enabled
                    is_visible = await load_more_button.is_visible()
                    is_disabled = await load_more_button.get_attribute("disabled")
                    
                    if not is_visible or is_disabled == "true":
                        print("🛑 Load More button is not visible or disabled")
                        break
                    
                    # Get current job count before clicking
                    current_jobs = await page.locator(self.config["job_card"]).count()
                    print(f"📊 Current job cards: {current_jobs}")
                    
                    # Scroll to Load More button and click it
                    await load_more_button.scroll_into_view_if_needed()
                    await page.wait_for_timeout(500)  # Reduced from 1000ms
                    
                    print("🔍 Clicking Load More button...")
                    await load_more_button.click()
                    
                    # Wait for new jobs to load
                    await page.wait_for_timeout(1500)  # Reduced from 3000ms
                    
                    # Check if new jobs were loaded
                    new_jobs = await page.locator(self.config["job_card"]).count()
                    
                    if new_jobs > current_jobs:
                        print(f"✅ Loaded {new_jobs - current_jobs} more jobs (Total: {new_jobs})")
                        
                        # Additional wait for content to stabilize
                        await page.wait_for_timeout(1000)  # Reduced from 2000ms
                    else:
                        print("🛑 No new jobs loaded, stopping")
                        break
                        
                else:
                    print("🛑 Load More button not found")
                    break
                
                # Safety check - prevent infinite loops
                if load_count >= 50:  # Max 50 load attempts
                    print("⚠️ Maximum load attempts reached, stopping")
                    break
        
        except Exception as e:
            print(f"❌ Error during Load More process: {str(e)}")
        
        # Final count
        final_jobs = await page.locator(self.config["job_card"]).count()
        print(f"\n🎉 LOAD MORE COMPLETED")
        print(f"📊 Total jobs loaded: {final_jobs}")
        print(f"📈 Jobs added: {final_jobs - initial_jobs}")
        print(f"🔄 Load attempts: {load_count}")
        print("=" * 50)
    
    async def process_jobs_with_progressive_loading(self, page):
        """Process jobs in batches of 10, clicking Load More when needed"""
        print("\n🔄 PROGRESSIVE LOADING & PROCESSING (10 jobs at a time)")
        print("=" * 60)
        
        batch_size = 10
        processed_count = 0
        total_processed = 0
        
        while True:
            # Get current available job cards
            job_cards = await page.locator(self.config["job_card"]).all()
            available_jobs = len(job_cards)
            
            print(f"\n📊 Available jobs: {available_jobs}, Processed: {processed_count}")
            
            # Calculate how many jobs we can process in this batch
            jobs_to_process = min(batch_size, available_jobs - processed_count)
            
            if jobs_to_process <= 0:
                print("🛑 No more jobs to process")
                break
            
            print(f"🔍 Processing batch: jobs {processed_count + 1} to {processed_count + jobs_to_process}")
            
            # Process the current batch of jobs
            batch_processed = 0
            for i in range(processed_count, processed_count + jobs_to_process):
                try:
                    print(f"Processing job {i+1}/{available_jobs}")
                    
                    # Get the specific job card
                    card = job_cards[i]
                    
                    # Scroll card into view
                    await card.scroll_into_view_if_needed()
                    await page.wait_for_timeout(200)
                    
                    # Initialize job info with defaults
                    job_info = {
                        'title': "N/A",
                        'location': "N/A", 
                        'posted_date': "N/A",
                        'description': "N/A",
                        'requirements': "N/A",
                        'employment_type': "N/A",
                        'full_job_details': "N/A"
                    }
                    
                    # Get current URL before clicking
                    current_url = page.url
                    
                    # Click on the job card to navigate to details page
                    try:
                        # Try multiple click targets in order of preference
                        click_targets = [
                            self.config.get("click_target", ""),
                            "button[data-test-id*='job-card-apply-button']",
                            self.config["title"],
                            self.config["job_card"]
                        ]
                        
                        clicked = False
                        for target_selector in click_targets:
                            if not target_selector:
                                continue
                                
                            try:
                                click_target = card.locator(target_selector).first
                                if await click_target.count() > 0:
                                    print(f"🔍 Clicking on job using selector '{target_selector}'")
                                    await click_target.click()
                                    clicked = True
                                    break
                            except Exception as e:
                                print(f"⚠️ Failed to click with selector '{target_selector}': {str(e)}")
                                continue
                        
                        if not clicked:
                            print(f"⚠️ No clickable element found for job {i+1}")
                            job_info['apply_link'] = "N/A"
                            continue
                        
                        # Wait for navigation or content change
                        try:
                            await page.wait_for_url(lambda url: url != current_url, timeout=5000)
                            print(f"✅ Navigated to job detail page")
                        except:
                            await page.wait_for_timeout(1500)
                            print(f"⚠️ No navigation detected, checking for content changes")
                        
                        # Get the job detail URL
                        job_detail_url = page.url
                        job_info['apply_link'] = job_detail_url
                        
                        # Extract detailed information
                        detailed_info = await self.extract_job_details(page)
                        job_info.update(detailed_info)
                        
                        print(f"✅ Extracted detailed info for: {job_info['title']}")
                        
                        # Navigate back to the job listing page
                        if job_detail_url != current_url:
                            await page.go_back()
                            await page.wait_for_timeout(1000)
                            await page.wait_for_selector(self.config["job_card"], timeout=10000)
                            
                            # Refresh job cards array after navigation
                            job_cards = await page.locator(self.config["job_card"]).all()
                        
                    except Exception as click_error:
                        print(f"❌ Error clicking job card {i+1}: {str(click_error)}")
                        job_info['apply_link'] = "N/A"
                        # Try to get back to listing page if lost
                        if page.url != current_url:
                            try:
                                await page.goto(self.careers_url, wait_until="domcontentloaded")
                                await page.wait_for_timeout(1500)
                                await page.wait_for_selector(self.config["job_card"], timeout=10000)
                                job_cards = await page.locator(self.config["job_card"]).all()
                            except:
                                print("❌ Failed to return to listing page")
                                break
                    
                    # Add metadata
                    job_info['company'] = self.config["company"]
                    job_info['scraped_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
                    job_info['batch_number'] = (processed_count // batch_size) + 1
                    job_info['source_url'] = self.careers_url
                    
                    self.job_data.append(job_info)
                    batch_processed += 1
                    total_processed += 1
                    
                    print(f"✅ Completed: {job_info['title']} - {job_info['location']}")
                    
                except Exception as e:
                    print(f"❌ Error processing job card {i+1}: {str(e)}")
                    continue
            
            # Update processed count
            processed_count += batch_processed
            
            print(f"✅ Batch completed: {batch_processed} jobs processed")
            print(f"📊 Total processed so far: {total_processed}")
            
            # Check if we need to load more jobs
            current_jobs = await page.locator(self.config["job_card"]).count()
            
            # If we've processed all currently available jobs, try to load more
            if processed_count >= current_jobs:
                print(f"\n🔄 Processed all available jobs ({current_jobs}), trying to load more...")
                
                # Look for Load More button
                load_more_button = page.locator(self.config["pagination_selector"]).first
                
                if await load_more_button.count() > 0:
                    is_visible = await load_more_button.is_visible()
                    is_disabled = await load_more_button.get_attribute("disabled")
                    
                    if is_visible and is_disabled != "true":
                        print("🔍 Clicking Load More button...")
                        await load_more_button.scroll_into_view_if_needed()
                        await page.wait_for_timeout(500)
                        await load_more_button.click()
                        
                        # Wait for new jobs to load
                        await page.wait_for_timeout(1500)
                        
                        # Check if new jobs were loaded
                        new_job_count = await page.locator(self.config["job_card"]).count()
                        
                        if new_job_count > current_jobs:
                            print(f"✅ Loaded {new_job_count - current_jobs} more jobs (Total: {new_job_count})")
                            # Refresh job cards array
                            job_cards = await page.locator(self.config["job_card"]).all()
                            continue  # Continue processing with new jobs
                        else:
                            print("🛑 No new jobs loaded, stopping")
                            break
                    else:
                        print("🛑 Load More button is not available or disabled")
                        break
                else:
                    print("🛑 Load More button not found")
                    break
            else:
                # We still have jobs to process, continue with next batch
                continue
        
        print(f"\n🎉 PROGRESSIVE PROCESSING COMPLETED")
        print(f"📊 Total jobs processed: {total_processed}")
        print(f"🔢 Batches processed: {(total_processed + batch_size - 1) // batch_size}")
        print("=" * 60)
    
    async def extract_job_details(self, page):
        """Extract detailed job information from job detail page using configurable detail container"""
        job_details = {}
        
        # Get the detail container selector from config (fallback to .position-container)
        detail_container_selector = self.config.get("detail_container", ".position-container")
        
        try:
            print(f"🔍 Looking for detail container: {detail_container_selector}")
            
            # Wait for detail container to load with better content detection
            await page.wait_for_selector(detail_container_selector, timeout=10000)
            
            # Additional wait to ensure content is fully loaded
            await page.wait_for_timeout(2000)
            
            # Wait for the detail container to have substantial content (not just "Loading...")
            try:
                await page.wait_for_function(
                    f"document.querySelector('{detail_container_selector}')?.textContent?.length > 100",
                    timeout=15000
                )
                print("✅ Detail container loaded with substantial content")
            except:
                print("⚠️ Detail container content may still be loading, proceeding anyway")
            
            # Get the detail container element
            detail_container = page.locator(detail_container_selector).first
            
            if await detail_container.count() > 0:
                print("✅ Found detail container element")
                
                # Extract the entire content from detail container
                full_content = await detail_container.text_content()
                
                if full_content and full_content.strip():
                    print(f"📋 Detail container content length: {len(full_content)}")
                    
                    # Store the full content as structured data
                    job_details['full_job_details'] = full_content.strip()
                    
                    # Get detail selectors from config
                    detail_selectors = self.config.get("detail_selectors", {})
                    
                    # Try to extract specific fields using selectors within the container
                    for field, selectors in detail_selectors.items():
                        try:
                            value = None
                            for selector in selectors:
                                try:
                                    element = detail_container.locator(selector).first
                                    if await element.count() > 0:
                                        text = await element.text_content()
                                        if text and text.strip():
                                            value = text.strip()
                                            print(f"📋 Extracted {field} using selector '{selector}': {value[:100]}...")
                                            break
                                except:
                                    continue
                            
                            # Special handling for certain fields
                            if field == 'description' and value:
                                job_details['description'] = value[:5000]  # Limit length
                            elif field == 'requirements' and value:
                                job_details['requirements'] = value[:3000]  # Limit length
                            else:
                                job_details[field] = value if value else "N/A"
                                
                        except Exception as e:
                            print(f"⚠️ Error extracting {field}: {str(e)}")
                            job_details[field] = "N/A"
                    
                    # Ensure all expected fields exist
                    expected_fields = ['title', 'description', 'requirements', 'location', 'employment_type', 'posted_date']
                    for field in expected_fields:
                        if field not in job_details:
                            job_details[field] = "N/A"
                    
                    print("✅ Successfully extracted job details from detail container")
                    
                else:
                    print("⚠️ Detail container found but no content extracted")
                    job_details = self._get_default_job_details("No content found")
            else:
                print("⚠️ Detail container element not found")
                job_details = self._get_default_job_details("Container not found")
                
        except Exception as e:
            print(f"⚠️ Error extracting from detail container: {str(e)}")
            job_details = self._get_default_job_details(f"Error: {str(e)}")
        
        return job_details
    
    def _get_default_job_details(self, error_msg="N/A"):
        """Return default job details structure"""
        return {
            'title': "N/A",
            'description': "N/A",
            'requirements': "N/A",
            'location': "N/A",
            'employment_type': "N/A",
            'posted_date': "N/A",
            'full_job_details': error_msg
        }
    
    async def extract_with_fallback(self, page, selectors):
        """Extract text using multiple selector fallbacks"""
        for selector in selectors:
            try:
                element = page.locator(selector).first
                if await element.count() > 0:
                    text = await element.text_content()
                    if text and text.strip():
                        return text.strip()
            except:
                continue
        return "N/A"
    
    async def scrape_job_details(self, job_url):
        """Scrape detailed information from a specific job URL"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            
            try:
                page = await browser.new_page()
                await page.set_viewport_size({"width": 1920, "height": 1080})
                
                print(f"Scraping job details from: {job_url}")
                
                # Add timeout and better error handling
                try:
                    await page.goto(job_url, wait_until="domcontentloaded", timeout=20000)  # Fixed timeout from 2000 to 20000
                    print("✅ Page loaded successfully")
                except Exception as e:
                    print(f"⚠️ Page load error: {str(e)}")
                    return {'url': job_url, 'error': f'Page load failed: {str(e)}'}
                
                # Wait for job content to load - reduced wait time
                await page.wait_for_timeout(1500)  # Reduced from 3000ms
                print("✅ Waiting period completed")
                
                # Extract detailed job information
                job_data = {}
                
                # Try to extract job title (more detailed)
                try:
                    print("🔍 Extracting job title...")
                    title_selectors = [
                        "h1[data-automation-id='jobPostingHeader']",
                        "h1",
                        ".job-title",
                        "[data-automation-id='jobTitle']",
                        "[class*='title']"
                    ]
                    title = None
                    for selector in title_selectors:
                        try:
                            element = page.locator(selector).first
                            if await element.count() > 0:
                                title = await element.text_content()
                                if title:
                                    print(f"✅ Found title with selector: {selector}")
                                    break
                        except:
                            continue
                    job_data['title'] = title.strip() if title else "N/A"
                    print(f"📋 Title: {job_data['title']}")
                except Exception as e:
                    print(f"⚠️ Error extracting title: {str(e)}")
                    job_data['title'] = "N/A"
                
                # Try to extract job description
                try:
                    print("🔍 Extracting job description...")
                    desc_selectors = [
                        "[data-automation-id='jobPostingDescription']",
                        ".position-full-card",
                        "[data-automation-id='description']",
                        ".description",
                        ".content"
                    ]
                    description = None
                    for selector in desc_selectors:
                        try:
                            element = page.locator(selector).first
                            if await element.count() > 0:
                                description = await element.text_content()
                                if description and description.strip():
                                    print(f"✅ Found description with selector: {selector}")
                                    break
                        except:
                            continue
                    job_data['description'] = description.strip() if description else "N/A"
                    print(f"📋 Description length: {len(job_data['description'])}")
                except Exception as e:
                    print(f"⚠️ Error extracting description: {str(e)}")
                    job_data['description'] = "N/A"
                
                # Try to extract additional details
                try:
                    print("🔍 Extracting job requirements...")
                    # Job requirements
                    req_selectors = [
                        "[data-automation-id='qualifications']",
                        ".qualifications",
                        "[class*='requirement']"
                    ]
                    requirements = None
                    for selector in req_selectors:
                        try:
                            element = page.locator(selector).first
                            if await element.count() > 0:
                                requirements = await element.text_content()
                                if requirements and requirements.strip():
                                    print(f"✅ Found requirements with selector: {selector}")
                                    break
                        except:
                            continue
                    job_data['requirements'] = requirements.strip() if requirements else "N/A"
                    print(f"📋 Requirements length: {len(job_data['requirements'])}")
                except Exception as e:
                    print(f"⚠️ Error extracting requirements: {str(e)}")
                    job_data['requirements'] = "N/A"
                
                job_data['url'] = job_url
                job_data['scraped_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
                
                print(f"✅ Extracted detailed job data: {job_data['title']}")
                return job_data
                
            except Exception as e:
                print(f"❌ Error scraping job details from {job_url}: {str(e)}")
                return {'url': job_url, 'error': str(e)}
                
            finally:
                await browser.close()
    
    def save_results(self, filename=None):
        """Save scraped job data to a JSON file"""
        if not filename:
            company_name = self.config["company"].lower().replace(" ", "_")
            timestamp = time.strftime('%Y%m%d_%H%M%S')
            filename = f"{company_name}_jobs_{timestamp}.json"
        
        data = {
            'company': self.config["company"],
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'source_url': self.careers_url,
            'configuration': self.config,
            'total_jobs': len(self.job_data),
            'jobs': self.job_data
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Results saved to {filename}")
        return filename

def load_company_config(config_file):
    """Load company configuration from JSON file"""
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading config file: {str(e)}")
        return None

async def main():
    """Main function to run the scraper with multi-company support"""
    
    # Configuration options
    selectors_file = "multi_company_selectors.json"
    
    print("🚀 Starting Enhanced Universal Job Scraper...")
    print("=" * 60)
    
    # Check if selectors file exists
    import os
    if not os.path.exists(selectors_file):
        print(f"❌ Selectors file not found: {selectors_file}")
        print("Creating default selectors file...")
        # The file was already created above
        
    # Show available companies
    print("\n📋 MULTI-COMPANY JOB SCRAPER")
    print("=" * 40)
    available_companies = UniversalJobScraper.list_available_companies(selectors_file)
    
    if not available_companies:
        print("❌ No companies found in selectors file")
        return
    
    # For demo, let's scrape Zebra (you can modify this to accept user input)
    company_to_scrape = "zebra"  # Change this to scrape different companies
    
    print(f"\n🎯 Selected Company: {company_to_scrape}")
    print("=" * 40)
    
    try:
        # Initialize scraper with selected company
        scraper = UniversalJobScraper(
            company_name=company_to_scrape, 
            selectors_file=selectors_file
        )
        
        print(f"🏢 Company: {scraper.config['company']}")
        print(f"🔗 URL: {scraper.config['url']}")
        print(f"🎯 Click Target: {scraper.config['click_target']}")
        print(f"📄 Pagination Type: {scraper.config['pagination_type']}")
        print(f"📦 Detail Container: {scraper.config.get('detail_container', 'N/A')}")
        print(f"📋 Detail Fields: {', '.join(scraper.config.get('detail_selectors', {}).keys())}")
        print("=" * 60)
        
        # Scrape job data
        job_data = await scraper.scrape_jobs()
        
        if job_data:
            # Save results to file
            filename = scraper.save_results()
            
            # Display summary
            print("\n📊 SCRAPING SUMMARY")
            print("=" * 40)
            print(f"✅ Total jobs scraped: {len(job_data)}")
            print(f"📄 Results saved to: {filename}")
            
            # Show first few jobs as examples
            print(f"\n📋 First 3 jobs preview:")
            for i, job in enumerate(job_data[:3]):
                print(f"\n{i+1}. {job['title']}")
                print(f"   📍 Location: {job['location']}")
                print(f"   📅 Posted: {job['posted_date']}")
                print(f"   🔗 Apply: {job['apply_link']}")
            
            # Optionally scrape detailed information from first job
            if len(job_data) > 0 and job_data[0]['apply_link'] != "N/A":
                print(f"\n🔍 Scraping detailed information from first job...")
                try:
                    # Add timeout to prevent hanging
                    detailed_job = await asyncio.wait_for(
                        scraper.scrape_job_details(job_data[0]['apply_link']), 
                        timeout=60.0  # 60 second timeout
                    )
                    if detailed_job and 'error' not in detailed_job:
                        print(f"📝 Job Description Preview: {detailed_job.get('description', 'N/A')[:200]}...")
                    else:
                        print(f"⚠️ Failed to scrape detailed info: {detailed_job.get('error', 'Unknown error')}")
                except asyncio.TimeoutError:
                    print("⚠️ Detailed scraping timed out after 60 seconds")
                except Exception as e:
                    print(f"⚠️ Error during detailed scraping: {str(e)}")
        else:
            print("❌ No job data found!")
            
    except Exception as e:
        print(f"❌ Error initializing scraper: {str(e)}")

async def scrape_multiple_companies():
    """Function to scrape jobs from multiple companies"""
    selectors_file = "multi_company_selectors.json"
    
    # Get list of available companies
    available_companies = UniversalJobScraper.list_available_companies(selectors_file)
    
    if not available_companies:
        print("❌ No companies found in selectors file")
        return
    
    print(f"\n🚀 MULTI-COMPANY SCRAPING SESSION")
    print("=" * 50)
    
    all_results = {}
    
    # Scrape jobs from each company
    for company_name in available_companies:
        print(f"\n🎯 Scraping {company_name.upper()}...")
        print("=" * 30)
        
        try:
            scraper = UniversalJobScraper(
                company_name=company_name, 
                selectors_file=selectors_file
            )
            
            job_data = await scraper.scrape_jobs()
            
            if job_data:
                filename = scraper.save_results()
                all_results[company_name] = {
                    'jobs_count': len(job_data),
                    'filename': filename,
                    'jobs': job_data
                }
                print(f"✅ {company_name}: {len(job_data)} jobs scraped")
            else:
                print(f"⚠️ {company_name}: No jobs found")
                all_results[company_name] = {
                    'jobs_count': 0,
                    'filename': None,
                    'jobs': []
                }
                
        except Exception as e:
            print(f"❌ Error scraping {company_name}: {str(e)}")
            all_results[company_name] = {
                'jobs_count': 0,
                'filename': None,
                'error': str(e)
            }
    
    # Display final summary
    print(f"\n📊 MULTI-COMPANY SCRAPING SUMMARY")
    print("=" * 50)
    total_jobs = 0
    for company, result in all_results.items():
        jobs_count = result.get('jobs_count', 0)
        total_jobs += jobs_count
        status = "✅" if jobs_count > 0 else "⚠️"
        print(f"{status} {company.upper()}: {jobs_count} jobs")
        if result.get('filename'):
            print(f"   📄 File: {result['filename']}")
        if result.get('error'):
            print(f"   ❌ Error: {result['error']}")
    
    print(f"\n🎉 Total jobs across all companies: {total_jobs}")
    
    return all_results

def create_config_template():
    """Create a template configuration file"""
    template = {
        "company": "CompanyName",
        "url": "https://company.com/careers",
        "job_card": ".job-card-selector",
        "title": ".title-selector",
        "click_target": ".clickable-element",  # What to click to open job details
        "location": ".location-selector",
        "posted_selector": ".posted-date-selector",
        "pagination_selector": ".next-button",
        "pagination_type": "button_click",
        "detail_selectors": {
            "title": [".detail-title", "h1", ".job-title"],
            "description": [".job-description", ".description", ".content"],
            "requirements": [".requirements", ".qualifications", "[class*='requirement']"],
            "location": [".location", "[class*='location']"],
            "employment_type": [".employment-type", "[class*='employment']"],
            "posted_date": [".posted-date", "[class*='date']"],
            "department": [".department", "[class*='team']"],
            "experience_level": [".experience-level", "[class*='level']"],
            "skills": [".skills", "[class*='skill']"],
            "benefits": [".benefits", "[class*='benefit']"],
            "salary": [".salary", "[class*='salary']", "[class*='compensation']"]
        }
    }
    
    with open("company_config_template.json", 'w', encoding='utf-8') as f:
        json.dump(template, f, indent=2, ensure_ascii=False)
    
    print("✅ Enhanced configuration template created: company_config_template.json")
    print("📋 Template includes:")
    print("   - Basic selectors for job listing page")
    print("   - Click target for navigation to job details")
    print("   - Detail selectors for comprehensive job information")
    print("   - Multiple fallback selectors for each field")

if __name__ == "__main__":
    asyncio.run(main())

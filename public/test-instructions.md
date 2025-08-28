# UI Inspection Tool Test Case

## Test Steps:

### 1. Test Page URL
Enter the following URL in the tool:
```
http://localhost:3000/test-page.html
```

### 2. Design Size Settings
Select design size: **1440×900 (Mainstream)**

### 3. Upload Design Mockup
Convert the `design-mockup.svg` file to PNG and upload, or use the following method:
- Open `http://localhost:3000/design-mockup.svg` in browser
- Right-click "Save as image" and save as PNG format
- Upload to UI inspection tool

### 4. Comparison Key Points
**Intentional differences** between design mockup and actual page:

1. **Logo Text**: Actual is "UI Inspector", design shows "UI Inspector Pro"
2. **Sign Up Button Color**: Actual is blue (#667eea), design shows red (#ff6b6b)
3. **Main Title**: Actual is "Professional UI Inspection Tool", design shows "Professional UI Inspection Tool Plus"
4. **CTA Button Color**: Actual is white background with blue text, design shows red background with white text
5. **Decorative Elements**: Design has two additional semi-transparent circle decorations

### 5. Test Operations
1. Adjust design mockup transparency to 50%
2. Drag design mockup to align with page content
3. Select areas with differences (Logo, buttons, etc.)
4. Add issue descriptions, such as: "Button color doesn't match design"
5. Export inspection report

## Expected Results:
- Page displays at 1440×900 size (no scaling)
- Design mockup overlays perfectly, clearly showing 5 differences
- Can accurately select problem areas
- Generate Word report with issue screenshots

This test case perfectly simulates real UI inspection scenarios!
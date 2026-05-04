---
 paths:
   - "**/*.css"
   - "**/*.less"
---
# CSS 开发规范

当处理 CSS、SCSS 或组件样式时，请严格遵循以下规范：

## 1. 命名规范

### BEM 命名法
使用 BEM (Block Element Modifier) 命名规范：
```css
/* Block */
.login-form { }

/* Element */
.login-form__username { }
.login-form__password { }
.login-form__button { }

/* Modifier */
.login-form__button--disabled { }
.login-form__button--primary { }
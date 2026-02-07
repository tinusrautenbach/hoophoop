# Git Workflow

This workflow describes the standard process for contributing code.

## 1. Feature Development Cycle
1.  **Sync**: Ensure you are up to date with `main`.
    ```bash
    git checkout main
    git pull origin main
    ```
2.  **Branch**: Create a feature branch.
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Develop**: specific implementation steps...
4.  **Commit**: Regular commits with clear messages.
    ```bash
    git add .
    git commit -m "feat: description of change"
    ```
5.  **Test**: Run tests before pushing.
    ```bash
    npm test
    ```
6.  **Push**:
    ```bash
    git push origin feature/your-feature-name
    ```

## 2. Review & Merge
1.  Open a Pull Request (or equivalent if local).
2.  **Approval**: Get confirmation from the User.
3.  **Merge**:
    ```bash
    git checkout main
    git merge feature/your-feature-name
    ```

## 3. Branch Naming Convention
- `feature/` for new capabilities.
- `fix/` for bug fixes.
- `chore/` for maintenance/refactoring.

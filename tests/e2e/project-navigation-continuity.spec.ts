import { expect, test } from '@playwright/test'
import { createLocalCoreHarness } from './local-core-harness'

const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

test('ordinary Project open stays in the same tab and enters project continuity', async ({ page, context }) => {
  await page.goto('/projects')
  await expect(page.getByTestId('project-drive')).toBeVisible()

  const project = page.locator('.project-portal-wrap:not(.is-create) .project-portal').first()
  await expect(project).toBeVisible({ timeout: 15_000 })

  const beforePages = context.pages().length
  const label = await project.getAttribute('aria-label')
  expect(label).toMatch(/^打开项目 /)

  await project.click()

  await expect(page.getByTestId('canvas')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => context.pages().length).toBe(beforePages)
  await expect(page).toHaveURL(/\/projects\/[^/?#]+/)
})

test('Assembly project double-click returns to the selected project in the same tab', async ({ page, context }) => {
  await page.goto('/projects')
  await expect(page.getByTestId('project-drive')).toBeVisible()
  await page.getByRole('button', { name: '打开 Capture 装配来源' }).click()
  await expect(page.getByTestId('assembly-capture-workspace')).toBeVisible({ timeout: 10_000 })

  const target = page.locator('.assembly-project-target').first()
  await expect(target).toBeVisible({ timeout: 10_000 })
  const beforePages = context.pages().length

  await target.dblclick()

  await expect(page.getByTestId('canvas')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => context.pages().length).toBe(beforePages)
  await expect(page).toHaveURL(/\/projects\/[^/?#]+/)
})

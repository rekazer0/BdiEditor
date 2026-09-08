// AI Chat Enhanced - 流式输出和思考内容增强模块

export type ThinkingBlock = {
  element: HTMLElement
  toggle: () => void
  setContent: (text: string) => void
  setExpanded: (expanded: boolean) => void
  remove: () => void
}

export type StreamingEnhancer = {
  startStreaming: (container: HTMLElement) => void
  stopStreaming: () => void
  addCharacter: (char: string) => void
  showThinking: (text: string) => void
  hideThinking: () => void
  showInterruptGuide: (onInterrupt: () => void) => void
  hideInterruptGuide: () => void
}

/**
 * 创建思考内容区块
 */
export function createThinkingBlock(): ThinkingBlock {
  const block = document.createElement("div")
  block.className = "thinking-block"

  const header = document.createElement("div")
  header.className = "thinking-header"
  header.setAttribute("role", "button")
  header.setAttribute("tabindex", "0")
  header.setAttribute("aria-expanded", "false")
  header.setAttribute("aria-label", "思考过程，点击展开或收起")

  const icon = document.createElement("span")
  icon.className = "thinking-icon"
  icon.setAttribute("aria-hidden", "true")
  icon.textContent = "▶"

  const title = document.createElement("span")
  title.className = "thinking-title"
  title.textContent = "💭 思考过程"

  const status = document.createElement("span")
  status.className = "thinking-status"
  status.textContent = "展开"

  header.append(icon, title, status)

  const content = document.createElement("div")
  content.className = "thinking-content"
  content.setAttribute("role", "region")
  content.setAttribute("aria-label", "思考详情")

  const text = document.createElement("div")
  text.className = "thinking-text"

  content.appendChild(text)
  block.append(header, content)

  let isExpanded = false

  const toggle = () => {
    isExpanded = !isExpanded
    content.classList.toggle("expanded", isExpanded)
    icon.classList.toggle("expanded", isExpanded)
    status.textContent = isExpanded ? "收起" : "展开"
    header.setAttribute("aria-expanded", String(isExpanded))

    // 展开时自动滚动到可视区域
    if (isExpanded) {
      setTimeout(() => {
        content.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 300)
    }
  }

  header.addEventListener("click", toggle)
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      toggle()
    }
  })

  return {
    element: block,
    toggle,
    setContent: (newText: string) => {
      text.textContent = newText
      // 如果已展开，滚动到底部显示最新内容
      if (isExpanded) {
        setTimeout(() => {
          content.scrollTop = content.scrollHeight
        }, 0)
      }
    },
    setExpanded: (expanded: boolean) => {
      if (isExpanded !== expanded) toggle()
    },
    remove: () => {
      block.remove()
    },
  }
}

/**
 * 创建打断引导按钮
 */
function createInterruptGuide(onInterrupt: () => void): HTMLElement {
  const guide = document.createElement("div")
  guide.className = "interrupt-guide"
  guide.setAttribute("role", "button")
  guide.setAttribute("tabindex", "0")
  guide.setAttribute("aria-label", "停止生成并提出新问题")

  const icon = document.createElement("span")
  icon.className = "interrupt-icon"
  icon.textContent = "⏸"
  icon.setAttribute("aria-hidden", "true")

  const label = document.createElement("span")
  label.textContent = "停止生成"

  const hint = document.createElement("span")
  hint.className = "shortcut-hint"
  hint.textContent = "或直接输入新问题"
  hint.setAttribute("aria-hidden", "true")

  guide.append(icon, label, hint)

  const handleClick = () => {
    onInterrupt()
    guide.remove()
  }

  guide.addEventListener("click", handleClick)
  guide.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleClick()
    }
  })

  return guide
}

/**
 * 创建流式输出增强器
 */
export function createStreamingEnhancer(): StreamingEnhancer {
  let cursor: HTMLElement | null = null
  let currentContainer: HTMLElement | null = null
  let loadingIndicator: HTMLElement | null = null
  let statusIndicator: HTMLElement | null = null
  let thinkingBlock: ThinkingBlock | null = null
  let interruptGuide: HTMLElement | null = null
  let isStreaming = false

  const startStreaming = (container: HTMLElement) => {
    currentContainer = container
    isStreaming = true

    // 创建光标
    cursor = document.createElement("span")
    cursor.className = "typing-cursor"
    cursor.setAttribute("aria-hidden", "true")
    container.appendChild(cursor)

    // 创建加载指示器
    loadingIndicator = document.createElement("div")
    loadingIndicator.className = "stream-loading-indicator active"
    loadingIndicator.setAttribute("role", "progressbar")
    loadingIndicator.setAttribute("aria-label", "正在生成内容")
    container.parentElement?.appendChild(loadingIndicator)

    // 创建状态指示器
    statusIndicator = document.createElement("div")
    statusIndicator.className = "stream-status-indicator active"
    statusIndicator.setAttribute("role", "status")
    statusIndicator.setAttribute("aria-live", "polite")
    statusIndicator.innerHTML = `
      <span class="status-dot" aria-hidden="true"></span>
      <span>正在生成...</span>
    `
    container.parentElement?.appendChild(statusIndicator)
  }

  const stopStreaming = () => {
    isStreaming = false

    cursor?.remove()
    cursor = null

    loadingIndicator?.classList.remove("active")
    setTimeout(() => {
      loadingIndicator?.remove()
      loadingIndicator = null
    }, 300)

    statusIndicator?.classList.remove("active")
    setTimeout(() => {
      statusIndicator?.remove()
      statusIndicator = null
    }, 300)

    // 移除打断引导
    interruptGuide?.remove()
    interruptGuide = null

    currentContainer = null
  }

  const addCharacter = (char: string) => {
    if (!currentContainer || !cursor) return

    const span = document.createElement("span")
    span.textContent = char
    span.className = "char-fade-in"

    currentContainer.insertBefore(span, cursor)

    // 自动滚动到最新内容
    const messageElement = currentContainer.closest(".message-bubble")
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

  const showThinking = (text: string) => {
    if (!currentContainer) return

    // 如果已经有思考块，更新内容
    if (thinkingBlock) {
      thinkingBlock.setContent(text)
      return
    }

    // 创建新的思考块
    thinkingBlock = createThinkingBlock()
    thinkingBlock.setContent(text)

    // 插入到消息开头
    const messageContainer = currentContainer.closest(".message-bubble")
    if (messageContainer) {
      const firstChild = messageContainer.firstChild
      messageContainer.insertBefore(thinkingBlock.element, firstChild)

      // 添加淡入动画
      requestAnimationFrame(() => {
        thinkingBlock?.element.style.opacity = "0"
        thinkingBlock?.element.style.transform = "translateY(10px)"
        setTimeout(() => {
          if (thinkingBlock) {
            thinkingBlock.element.style.transition = "opacity 0.3s ease, transform 0.3s ease"
            thinkingBlock.element.style.opacity = "1"
            thinkingBlock.element.style.transform = "translateY(0)"
          }
        }, 10)
      })
    }
  }

  const hideThinking = () => {
    if (thinkingBlock) {
      // 添加淡出动画
      thinkingBlock.element.style.opacity = "0"
      thinkingBlock.element.style.transform = "translateY(-10px)"
      setTimeout(() => {
        thinkingBlock?.remove()
        thinkingBlock = null
      }, 300)
    }
  }

  const showInterruptGuide = (onInterrupt: () => void) => {
    if (!isStreaming || !currentContainer) return
    if (interruptGuide) return // 已经显示了

    interruptGuide = createInterruptGuide(onInterrupt)

    const messageContainer = currentContainer.closest(".message-bubble")
    if (messageContainer) {
      messageContainer.appendChild(interruptGuide)

      // 添加淡入动画
      requestAnimationFrame(() => {
        if (interruptGuide) {
          interruptGuide.style.opacity = "0"
          interruptGuide.style.transform = "translateY(5px)"
          setTimeout(() => {
            if (interruptGuide) {
              interruptGuide.style.transition = "opacity 0.25s ease, transform 0.25s ease"
              interruptGuide.style.opacity = "1"
              interruptGuide.style.transform = "translateY(0)"
            }
          }, 10)
        }
      })
    }
  }

  const hideInterruptGuide = () => {
    if (interruptGuide) {
      interruptGuide.style.opacity = "0"
      interruptGuide.style.transform = "translateY(5px)"
      setTimeout(() => {
        interruptGuide?.remove()
        interruptGuide = null
      }, 250)
    }
  }

  return {
    startStreaming,
    stopStreaming,
    addCharacter,
    showThinking,
    hideThinking,
    showInterruptGuide,
    hideInterruptGuide,
  }
}

/**
 * 增强 Deep Chat 消息以支持流式输出
 */
export function enhanceDeepChatMessage(messageElement: HTMLElement): StreamingEnhancer {
  const enhancer = createStreamingEnhancer()

  // 查找消息内容容器
  const contentContainer = messageElement.querySelector(".message-content") as HTMLElement
  if (contentContainer) {
    enhancer.startStreaming(contentContainer)
  }

  return enhancer
}

/**
 * 为输入框添加工具栏（字数统计、附件上传等）
 */
export type InputToolbar = {
  updateCharCount: (count: number) => void
  setAttachment: (file: File | null) => void
  onAttachmentClick?: () => void
}

export function createInputToolbar(inputContainer: HTMLElement): InputToolbar {
  const toolbar = document.createElement("div")
  toolbar.className = "ai-input-toolbar"
  toolbar.setAttribute("role", "toolbar")
  toolbar.setAttribute("aria-label", "输入工具栏")

  const toolbarLeft = document.createElement("div")
  toolbarLeft.className = "toolbar-left"

  // 附件按钮
  const attachButton = document.createElement("button")
  attachButton.className = "toolbar-button"
  attachButton.innerHTML = "📎"
  attachButton.title = "上传附件（暂未开放）"
  attachButton.setAttribute("aria-label", "上传附件")
  attachButton.type = "button"
  attachButton.disabled = true // 暂时禁用

  const attachmentBadge = document.createElement("span")
  attachmentBadge.id = "attachmentBadge"
  attachmentBadge.setAttribute("role", "status")
  attachmentBadge.setAttribute("aria-live", "polite")

  toolbarLeft.append(attachButton, attachmentBadge)

  // 字数统计
  const charCount = document.createElement("div")
  charCount.className = "char-count"
  charCount.textContent = "0"
  charCount.setAttribute("role", "status")
  charCount.setAttribute("aria-live", "polite")
  charCount.setAttribute("aria-label", "已输入0个字符")

  toolbar.append(toolbarLeft, charCount)

  // 插入到输入容器
  inputContainer.style.position = "relative"
  inputContainer.appendChild(toolbar)

  return {
    updateCharCount: (count: number) => {
      charCount.textContent = String(count)
      charCount.setAttribute("aria-label", `已输入${count}个字符`)

      charCount.classList.remove("warning", "error")
      if (count > 2000) {
        charCount.classList.add("error")
      } else if (count > 1500) {
        charCount.classList.add("warning")
      }
    },
    setAttachment: (file: File | null) => {
      if (file) {
        attachmentBadge.innerHTML = `
          <span class="attachment-badge">
            <span class="attachment-badge-text">📄 ${file.name}</span>
            <span class="attachment-remove" role="button" tabindex="0" aria-label="移除附件">×</span>
          </span>
        `
        const removeBtn = attachmentBadge.querySelector(".attachment-remove")
        if (removeBtn) {
          const handleRemove = () => {
            attachmentBadge.innerHTML = ""
          }
          removeBtn.addEventListener("click", handleRemove)
          removeBtn.addEventListener("keydown", (event) => {
            if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
              event.preventDefault()
              handleRemove()
            }
          })
        }
      } else {
        attachmentBadge.innerHTML = ""
      }
    },
    onAttachmentClick: undefined,
  }
}

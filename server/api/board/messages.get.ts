import { listBoardMessages, parseBoardCursor } from '../../utils/board'

export default defineEventHandler((event) => {
  const after = parseBoardCursor(getQuery(event).after)
  return { items: listBoardMessages(after) }
})

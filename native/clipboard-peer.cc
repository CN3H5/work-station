#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <wchar.h>
int wmain(int argc, wchar_t** argv) {
  HWND owner = CreateWindowExW(0,L"STATIC",L"WorkStationFictionalClipboardPeer",0,0,0,0,0,HWND_MESSAGE,nullptr,GetModuleHandleW(nullptr),nullptr);
  if (!owner || !OpenClipboard(owner)) return 2;
  if (argc > 1 && wcscmp(argv[1], L"hold") == 0) {
    puts("locked"); fflush(stdout); Sleep(1800); CloseClipboard(); DestroyWindow(owner); return 0;
  }
  const wchar_t* text = L"FICTIONAL-WORKSTATION-CLIPBOARD";
  HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, (wcslen(text)+1)*sizeof(wchar_t));
  if (!memory) { CloseClipboard(); return 3; }
  void* ptr=GlobalLock(memory); if (!ptr) { GlobalFree(memory);CloseClipboard(); return 3; }
  memcpy(ptr,text,(wcslen(text)+1)*sizeof(wchar_t)); GlobalUnlock(memory);
  if (!EmptyClipboard() || !SetClipboardData(CF_UNICODETEXT,memory)) { GlobalFree(memory); CloseClipboard(); return 4; }
  CloseClipboard(); DestroyWindow(owner); return 0;
}

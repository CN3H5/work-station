#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <node_api.h>
#include <stdint.h>
#include <string>
#include <cmath>

namespace {
HWND owner = nullptr;
uint64_t generation = 0;
DWORD sequence = 0;
bool active = false;
napi_value Result(napi_env env, const char* status) {
  napi_value object, value;
  napi_create_object(env, &object);
  napi_create_string_utf8(env, status, NAPI_AUTO_LENGTH, &value);
  napi_set_named_property(env, object, "status", value);
  napi_create_double(env, static_cast<double>(generation), &value);
  napi_set_named_property(env, object, "generation", value);
  napi_create_uint32(env, sequence, &value);
  napi_set_named_property(env, object, "sequence", value);
  napi_create_uint32(env, GetClipboardSequenceNumber(), &value);
  napi_set_named_property(env, object, "observedSequence", value);
  napi_get_boolean(env, GetClipboardOwner() == owner, &value);
  napi_set_named_property(env, object, "ownerMatches", value);
  return object;
}
napi_value Copy(napi_env env, napi_callback_info info) {
  size_t argc = 1, length = 0;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  napi_valuetype type;
  if (argc != 1 || napi_typeof(env, argv[0], &type) != napi_ok || type != napi_string ||
      napi_get_value_string_utf16(env, argv[0], nullptr, 0, &length) != napi_ok || length == 0 || length > 65536) {
    napi_throw_type_error(env, nullptr, "INVALID_SECRET"); return nullptr;
  }
  std::u16string text(length + 1, u'\0');
  napi_get_value_string_utf16(env, argv[0], &text[0], length + 1, &length);
  if (text.find(u'\0') < length) { SecureZeroMemory(&text[0], text.size()*2); napi_throw_type_error(env, nullptr, "INVALID_SECRET"); return nullptr; }
  if (!owner) owner = CreateWindowExW(0, L"STATIC", L"WorkStationClipboard", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, GetModuleHandleW(nullptr), nullptr);
  if (!owner || !OpenClipboard(owner)) { SecureZeroMemory(&text[0], text.size()*2); return Result(env, "busy"); }
  HGLOBAL memory = GlobalAlloc(GMEM_MOVEABLE, (length + 1) * sizeof(wchar_t));
  void* target = memory ? GlobalLock(memory) : nullptr;
  if (!target) { if (memory) GlobalFree(memory); CloseClipboard(); SecureZeroMemory(&text[0], text.size()*2); return Result(env, "failed"); }
  memcpy(target, text.data(), (length + 1) * sizeof(wchar_t));
  GlobalUnlock(memory);
  SecureZeroMemory(&text[0], text.size()*2);
  if (!EmptyClipboard() || !SetClipboardData(CF_UNICODETEXT, memory)) {
    void* bytes = GlobalLock(memory); if (bytes) { SecureZeroMemory(bytes, (length+1)*2); GlobalUnlock(memory); }
    GlobalFree(memory); CloseClipboard(); active = false; return Result(env, "failed");
  }
  generation++;
  CloseClipboard();
  // Windows may synthesize formats and advance the sequence during CloseClipboard.
  // Snapshot the published sequence, then the clearing path rechecks it under lock.
  sequence = GetClipboardSequenceNumber();
  active = GetClipboardOwner() == owner;
  return Result(env, active ? "copied" : "replaced");
}
napi_value Clear(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value argv[1]; double requested = 0;
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (argc != 1 || napi_get_value_double(env, argv[0], &requested) != napi_ok || !std::isfinite(requested) || requested < 1 || requested > 9007199254740991.0 || std::floor(requested) != requested) {
    napi_throw_type_error(env, nullptr, "INVALID_GENERATION"); return nullptr;
  }
  if (!active || requested != static_cast<double>(generation)) return Result(env, "stale");
  if (!OpenClipboard(owner)) return Result(env, "busy");
  // Version + owner + generation comparison and clearing share one OpenClipboard lock.
  if (requested != static_cast<double>(generation) || GetClipboardSequenceNumber() != sequence || GetClipboardOwner() != owner) {
    active = false; CloseClipboard(); return Result(env, "replaced");
  }
  const bool cleared = EmptyClipboard() != FALSE;
  if (cleared) active = false;
  CloseClipboard();
  return Result(env, cleared ? "cleared" : "failed");
}
void Cleanup(void*) { if (owner) DestroyWindow(owner); owner = nullptr; }
napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    {"copySecret", nullptr, Copy, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"clearIfUnchanged", nullptr, Clear, nullptr, nullptr, nullptr, napi_default, nullptr}
  };
  napi_define_properties(env, exports, 2, descriptors);
  napi_add_env_cleanup_hook(env, Cleanup, nullptr);
  return exports;
}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

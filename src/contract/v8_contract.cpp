#include <utils/base64.h>
#include <ledger/ledger_manager.h>
#include "contract_manager.h"

namespace bumo {
	std::map<std::string, std::string> V8Contract::jslib_sources_;
	std::map<std::string, v8::FunctionCallback> V8Contract::js_func_read_;
	std::map<std::string, v8::FunctionCallback> V8Contract::js_func_write_;

	std::map<std::string, v8::FunctionCallback> V8Contract::js_func_read_gt1001_;
	std::map<std::string, v8::FunctionCallback> V8Contract::js_func_write_gt1001_;

	std::string V8Contract::user_global_string_;
	std::string V8Contract::user_global_string_gt1001_;

	const std::string V8Contract::sender_name_ = "sender";
	const std::string V8Contract::origin_sender_name_ = "originSender";
	const std::string V8Contract::tx_initiator_name_ = "txInitiator";
	const std::string V8Contract::origin_tx_initiator_name_ = "originTxInitiator";
	const std::string V8Contract::this_address_ = "thisAddress";
	const char* V8Contract::main_name_ = "main";
	const char* V8Contract::query_name_ = "query";
	const char* V8Contract::init_name_ = "init";
	const char* V8Contract::call_jslint_ = "callJslint";
	const std::string V8Contract::trigger_tx_name_ = "trigger";
	const std::string V8Contract::trigger_tx_index_name_ = "triggerIndex";
	const std::string V8Contract::this_header_name_ = "consensusValue";
	const std::string V8Contract::pay_coin_amount_name_ = "thisPayCoinAmount";
	const std::string V8Contract::pay_asset_amount_name_ = "thisPayAsset";
	const std::string V8Contract::block_timestamp_name_ = "blockTimestamp";
	const std::string V8Contract::block_number_name_ = "blockNumber";
	utils::Mutex V8Contract::isolate_to_contract_mutex_;
	std::unordered_map<v8::Isolate*, V8Contract *> V8Contract::isolate_to_contract_;

	v8::Platform* V8Contract::platform_ = nullptr;
	v8::Isolate::CreateParams V8Contract::create_params_;

	V8Contract::V8Contract(bool readonly, const ContractParameter &parameter) : Contract(readonly, parameter) {
		type_ = TYPE_V8;
		isolate_ = v8::Isolate::New(create_params_);

		utils::MutexGuard guard(isolate_to_contract_mutex_);
		isolate_to_contract_[isolate_] = this;
	}

	V8Contract::~V8Contract() {
		utils::MutexGuard guard(isolate_to_contract_mutex_);
		isolate_to_contract_.erase(isolate_);
		isolate_->Dispose();
		isolate_ = NULL;
	}

	bool V8Contract::LoadJsFuncList() {
		//read func
		js_func_read_["log"] = V8Contract::CallBackLog;
		js_func_read_["getBalance"] = V8Contract::CallBackGetBalance;
		js_func_read_["getAccountAsset"] = V8Contract::CallBackGetAccountAsset;
		js_func_read_["storageLoad"] = V8Contract::CallBackStorageLoad;
		js_func_read_["getBlockHash"] = V8Contract::CallBackGetBlockHash;
		js_func_read_["contractQuery"] = V8Contract::CallBackContractQuery;
		js_func_read_["getValidators"] = V8Contract::CallBackGetValidators;
		js_func_read_[General::CHECK_TIME_FUNCTION] = V8Contract::InternalCheckTime;
		js_func_read_["stoI64Check"] = V8Contract::CallBackStoI64Check;
		js_func_read_["int64Add"] = V8Contract::CallBackInt64Add;
		js_func_read_["int64Sub"] = V8Contract::CallBackInt64Sub;
		js_func_read_["int64Mul"] = V8Contract::CallBackInt64Mul;
		js_func_read_["int64Mod"] = V8Contract::CallBackInt64Mod;
		js_func_read_["int64Div"] = V8Contract::CallBackInt64Div;
		js_func_read_["int64Compare"] = V8Contract::CallBackInt64Compare;
		js_func_read_["toBaseUnit"] = V8Contract::CallBackToBaseUnit;
		js_func_read_["assert"] = V8Contract::CallBackAssert;
		js_func_read_["addressCheck"] = V8Contract::CallBackAddressValidCheck;

		//write func
		js_func_write_["storageStore"] = V8Contract::CallBackStorageStore;
		js_func_write_["storageDel"] = V8Contract::CallBackStorageDel;
		js_func_write_["configFee"] = V8Contract::CallBackConfigFee;
		js_func_write_["setValidators"] = V8Contract::CallBackSetValidators;
		js_func_write_["payCoin"] = V8Contract::CallBackPayCoin;
		js_func_write_["issueAsset"] = V8Contract::CallBackIssueAsset;
		js_func_write_["payAsset"] = V8Contract::CallBackPayAsset;
		js_func_write_["tlog"] = V8Contract::CallBackTopicLog;

		//for gt1001 read func
		js_func_read_gt1001_["getAccountMetadata"] = V8Contract::CallBackGetAccountMetadata;
		js_func_read_gt1001_["sha256"] = V8Contract::CallBackSha256;
		js_func_read_gt1001_["ecVerify"] = V8Contract::CallBackVerify;
		js_func_read_gt1001_["toAddress"] = V8Contract::CallBackToAddress;
		js_func_read_gt1001_["getContractProperty"] = V8Contract::CallBackGetContractProperty;

		js_func_write_gt1001_["delegateCall"] = V8Contract::CallBackDelegateCall;
		js_func_write_gt1001_["contractCall"] = V8Contract::CallBackCall;
		js_func_write_gt1001_["contractCreate"] = V8Contract::CallBackCreate;
		
		


		return true;
	}

	bool V8Contract::LoadJsLibSource() {
		std::string lib_path = utils::String::Format("%s/jslib", utils::File::GetBinHome().c_str());
		utils::FileAttributes files;
		utils::File::GetFileList(lib_path, "*.js", files);
		for (utils::FileAttributes::iterator iter = files.begin(); iter != files.end(); iter++) {
			utils::FileAttribute attr = iter->second;
			utils::File file;
			std::string file_path = utils::String::Format("%s/%s", lib_path.c_str(), iter->first.c_str());
			if (!file.Open(file_path, utils::File::FILE_M_READ)) {
				LOG_ERROR_ERRNO("Failed to open js lib file, path(%s)", file_path.c_str(), STD_ERR_CODE, STD_ERR_DESC);
				continue;
			}

			std::string data;
			if (file.ReadData(data, 10 * utils::BYTES_PER_MEGA) < 0) {
				LOG_ERROR_ERRNO("Failed to read js lib file, path(%s)", file_path.c_str(), STD_ERR_CODE, STD_ERR_DESC);
				continue;
			}

			jslib_sources_[iter->first] = data;
		}

		return true;
	}

	bool V8Contract::LoadJslintGlobalString() {
		user_global_string_ = utils::String::AppendFormat(user_global_string_, "%s", sender_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", this_address_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", trigger_tx_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", trigger_tx_index_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", this_header_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", pay_coin_amount_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", pay_asset_amount_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", block_timestamp_name_.c_str());
		user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", block_number_name_.c_str());
		std::map<std::string, v8::FunctionCallback>::iterator itr;
		for (itr = js_func_read_.begin(); itr != js_func_read_.end(); itr++) {
			user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", itr->first.c_str());
		}
		for (itr = js_func_write_.begin(); itr != js_func_write_.end(); itr++) {
			user_global_string_ = utils::String::AppendFormat(user_global_string_, ",%s", itr->first.c_str());
		}

		//for gt1001
		user_global_string_gt1001_ = user_global_string_;
		user_global_string_gt1001_ = utils::String::AppendFormat(user_global_string_gt1001_, ",%s", origin_sender_name_.c_str());
		user_global_string_gt1001_ = utils::String::AppendFormat(user_global_string_gt1001_, ",%s", tx_initiator_name_.c_str());
		user_global_string_gt1001_ = utils::String::AppendFormat(user_global_string_gt1001_, ",%s", origin_tx_initiator_name_.c_str());

		for (itr = js_func_read_gt1001_.begin(); itr != js_func_read_gt1001_.end(); itr++) {
			user_global_string_gt1001_ = utils::String::AppendFormat(user_global_string_gt1001_, ",%s", itr->first.c_str());
		}
		for (itr = js_func_write_gt1001_.begin(); itr != js_func_write_gt1001_.end(); itr++) {
			user_global_string_gt1001_ = utils::String::AppendFormat(user_global_string_gt1001_, ",%s", itr->first.c_str());
		}
		return true;
	}

	std::string V8Contract::GetGlobalString() {
		std::string global_string = user_global_string_;
		if (CHECK_VERSION_GT_1001) {
			global_string = user_global_string_gt1001_;
		}
		return global_string;
	}

	bool V8Contract::Initialize(int argc, char** argv) {
		LoadJsFuncList();
		LoadJsLibSource();
		LoadJslintGlobalString();
		v8::V8::InitializeICUDefaultLocation(argv[0]);
		v8::V8::InitializeExternalStartupData(argv[0]);
		platform_ = v8::platform::CreateDefaultPlatform();
		v8::V8::InitializePlatform(platform_);
		if (!v8::V8::Initialize()) {
			LOG_ERROR("Failed to initialize V8.");
			return false;
		}
		create_params_.array_buffer_allocator =
			v8::ArrayBuffer::Allocator::NewDefaultAllocator();

		return true;
	}

	bool V8Contract::ExecuteCode() {
		v8::Isolate::Scope isolate_scope(isolate_);
		v8::HandleScope handle_scope(isolate_);
		v8::TryCatch try_catch(isolate_);

		v8::Local<v8::Context> context = CreateContext(isolate_, false);

		v8::Context::Scope context_scope(context);

		//block number, timestamp, orginal

		auto string_sender = v8::String::NewFromUtf8(isolate_, parameter_.sender_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, sender_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			string_sender);

		auto string_contractor = v8::String::NewFromUtf8(isolate_, parameter_.this_address_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, this_address_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			string_contractor);

		v8::Local<v8::Integer> index_v8 = v8::Int32::New(isolate_, parameter_.ope_index_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, trigger_tx_index_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			index_v8);

		auto coin_amount = v8::String::NewFromUtf8(isolate_, utils::String::ToString(parameter_.pay_coin_amount_).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, pay_coin_amount_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			coin_amount);

		if (parameter_.pay_asset_amount_.has_key()) {
			v8::Local<v8::Object> v8_asset = v8::Object::New(isolate_);
			v8::Local<v8::Object> v8_asset_property = v8::Object::New(isolate_);
			const protocol::AssetKey &asset_key = parameter_.pay_asset_amount_.key();
			v8_asset_property->Set(v8::String::NewFromUtf8(isolate_, "issuer"), v8::String::NewFromUtf8(isolate_, asset_key.issuer().c_str()));
			v8_asset_property->Set(v8::String::NewFromUtf8(isolate_, "code"), v8::String::NewFromUtf8(isolate_, asset_key.code().c_str()));
			v8_asset->Set(v8::String::NewFromUtf8(isolate_, "amount"), v8::String::NewFromUtf8(isolate_, utils::String::ToString(parameter_.pay_asset_amount_.amount()).c_str()));
			v8_asset->Set(v8::String::NewFromUtf8(isolate_, "key"), v8_asset_property);

			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, pay_asset_amount_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				v8_asset);
		}

		auto blocknumber_v8 = v8::Number::New(isolate_, (double)parameter_.blocknumber_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, block_number_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			blocknumber_v8);

		auto timestamp_v8 = v8::Number::New(isolate_, (double)parameter_.timestamp_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, block_timestamp_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			timestamp_v8);

		if (CHECK_VERSION_GT_1001) {
			auto string_origin_sender = v8::String::NewFromUtf8(isolate_, parameter_.ledger_context_->GetBottomTx()->GetOperatingSourceAddress().c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, origin_sender_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				string_origin_sender);

			auto tx_initiator = v8::String::NewFromUtf8(isolate_, parameter_.tx_initiator_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, tx_initiator_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				tx_initiator);

			auto string_origin_tx_initiator = v8::String::NewFromUtf8(isolate_, parameter_.ledger_context_->GetBottomTx()->GetSourceAddress().c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, origin_tx_initiator_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				string_origin_tx_initiator);
		}

		v8::Local<v8::String> v8src = v8::String::NewFromUtf8(isolate_, parameter_.code_.c_str());
		v8::Local<v8::Script> compiled_script;

		std::string fn_name = parameter_.init_ ? "init" : "main";
		do {
			Json::Value error_random;
			if (!RemoveRandom(isolate_, error_random)) {
				//"VERSION CHECKING condition" may be removed after version 1002
				if (CHECK_VERSION_GT_1001) {
					result_.set_code(protocol::ERRCODE_CONTRACT_EXECUTE_FAIL);
				}
				//--------end-----------

				result_.set_desc(error_random.toFastString());
				break;
			}

			v8::Local<v8::String> check_time_name(
				v8::String::NewFromUtf8(context->GetIsolate(), "__enable_check_time__",
				v8::NewStringType::kNormal).ToLocalChecked());
			v8::ScriptOrigin origin_check_time_name(check_time_name);

			if (!v8::Script::Compile(context, v8src, &origin_check_time_name).ToLocal(&compiled_script)) {
				//"VERSION CHECKING condition" may be removed after version 1002
				if (CHECK_VERSION_GT_1001) {
					result_.set_code(protocol::ERRCODE_CONTRACT_EXECUTE_FAIL);
				}

				result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
				break;
			}

			v8::Local<v8::Value> result;
			if (!compiled_script->Run(context).ToLocal(&result)) {
				//"VERSION CHECKING condition" may be removed after version 1002
				if (CHECK_VERSION_GT_1001) {
					if (result_.code() == 0) { //Set the code if it is not set.
						result_.set_code(protocol::ERRCODE_CONTRACT_EXECUTE_FAIL);
					}
				}

				result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
				break;
			}

			v8::Local<v8::String> process_name =
				v8::String::NewFromUtf8(isolate_, fn_name.c_str(), v8::NewStringType::kNormal, fn_name.size())
				.ToLocalChecked();
			v8::Local<v8::Value> process_val;

			if (!context->Global()->Get(context, process_name).ToLocal(&process_val) ||
				!process_val->IsFunction()) {
				Json::Value json_result;
				json_result["exception"] = utils::String::Format("Lost of %s function", fn_name.c_str());
				result_.set_code(protocol::ERRCODE_CONTRACT_EXECUTE_FAIL);
				result_.set_desc(json_result.toFastString());
				LOG_ERROR("%s", result_.desc().c_str());
				break;
			}

			v8::Local<v8::Function> process = v8::Local<v8::Function>::Cast(process_val);

			const int argc = 1;
			v8::Local<v8::String> arg1 = v8::String::NewFromUtf8(isolate_, parameter_.input_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();

			v8::Local<v8::Value> argv[argc];
			argv[0] = arg1;

			v8::Local<v8::Value> callresult;
			if (!process->Call(context, context->Global(), argc, argv).ToLocal(&callresult)) {
				if (result_.code() == 0) { //Set the code if it is not set.
					result_.set_code(protocol::ERRCODE_CONTRACT_EXECUTE_FAIL);
					result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
				}
				//Otherwise break. For example doTransaction has set the code.
				break;
			}

			Json::Value temp_result;
			JsValueToCppJson(context, callresult, temp_result);
			result_.set_contract_result(temp_result);

			return true;
		} while (false);
		//Json::Value &error_obj = js_result["error"]; //{"error":{"data" : "", "code" : 1}} or {"result": ""} refer json rpc
		//error_obj["data"] = result_.desc();
		return false;
	}

	bool V8Contract::Execute() {
		return ExecuteCode();
	}

	bool V8Contract::Cancel() {
		v8::V8::TerminateExecution(isolate_);
		return true;
	}

	bool V8Contract::SourceCodeCheck() {
		v8::Isolate::Scope isolate_scope(isolate_);
		v8::HandleScope handle_scope(isolate_);
		v8::TryCatch try_catch(isolate_);

		v8::Local<v8::Context> context = CreateContext(isolate_, false);
		v8::Context::Scope context_scope(context);

		std::string jslint_file = "jslint.js";
		std::map<std::string, std::string>::iterator find_jslint_source = jslib_sources_.find(jslint_file);
		if (find_jslint_source == jslib_sources_.end()) {
			Json::Value json_result;
			json_result["exception"] = utils::String::Format("Failed to find the include file(%s) in jslib directory", jslint_file.c_str());
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(json_result.toFastString());
			LOG_ERROR("Failed to find the include file(%s) in jslib directory", jslint_file.c_str());
			return false;
		}

		v8::Local<v8::String> v8src = v8::String::NewFromUtf8(isolate_, find_jslint_source->second.c_str());
		v8::Local<v8::Script> compiled_script;
		if (!v8::Script::Compile(context, v8src).ToLocal(&compiled_script)) {
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}
		Json::Value error_desc_f;
		v8::Local<v8::Value> result;
		if (!compiled_script->Run(context).ToLocal(&result)) {
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}
		v8::Local<v8::String> process_name = v8::String::NewFromUtf8(
			isolate_, V8Contract::call_jslint_, v8::NewStringType::kNormal, strlen(V8Contract::call_jslint_)).ToLocalChecked();

		v8::Local<v8::Value> process_val;
		if (!context->Global()->Get(context, process_name).ToLocal(&process_val) ||
			!process_val->IsFunction()) {
			Json::Value json_result;
			json_result["exception"] = utils::String::Format("Failed to find jslint name(%s)", call_jslint_);
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(json_result.toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}

		v8::Local<v8::Function> process = v8::Local<v8::Function>::Cast(process_val);
		const int argc = 2;
		v8::Local<v8::Value>  argv[argc];
		v8::Local<v8::String> arg1 = v8::String::NewFromUtf8(isolate_, parameter_.code_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		v8::Local<v8::String> arg2 = v8::String::NewFromUtf8(isolate_, GetGlobalString().c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		argv[0] = arg1;
		argv[1] = arg2;

		v8::Local<v8::Value> callRet;
		if (!process->Call(context, context->Global(), argc, argv).ToLocal(&callRet)) {
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(ReportException(isolate_, &try_catch).toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}
		if (!callRet->IsString()) {
			Json::Value json_result;
			json_result["exception"] = utils::String::Format("The result of jslint calling is not a string!");
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(json_result.toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}

		Json::Reader reader;
		Json::Value call_result_json;
		if (!reader.parse(std::string(ToCString(v8::String::Utf8Value(callRet))), call_result_json)) {
			Json::Value json_result;
			json_result["exception"] = utils::String::Format("Failed to parse jslint result, (%s)", reader.getFormatedErrorMessages().c_str());
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(json_result.toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}
		if (!call_result_json.empty()) {
			Json::Value json_result;
			json_result["exception"] = utils::String::Format("Failed to parse jslint result, (%s)", reader.getFormatedErrorMessages().c_str());
			result_.set_code(protocol::ERRCODE_CONTRACT_SYNTAX_ERROR);
			result_.set_desc(call_result_json.toFastString());
			LOG_ERROR("%s", result_.desc().c_str());
			return false;
		}

		LOG_INFO("Parse jslint successfully!");
		return true;
	}

	bool V8Contract::Query(Json::Value& js_result) {
		v8::Isolate::Scope isolate_scope(isolate_);
		v8::HandleScope    handle_scope(isolate_);
		v8::TryCatch       try_catch(isolate_);

		v8::Local<v8::Context>       context = CreateContext(isolate_, true);
		v8::Context::Scope            context_scope(context);

		auto string_sender = v8::String::NewFromUtf8(isolate_, parameter_.sender_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, sender_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			string_sender);

		auto string_contractor = v8::String::NewFromUtf8(isolate_, parameter_.this_address_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, this_address_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			string_contractor);

		v8::Local<v8::Integer> index_v8 = v8::Int32::New(isolate_, parameter_.ope_index_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, trigger_tx_index_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			index_v8);

		auto blocknumber_v8 = v8::Number::New(isolate_, (double)parameter_.blocknumber_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, block_number_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			blocknumber_v8);

		auto timestamp_v8 = v8::Number::New(isolate_, (double)parameter_.timestamp_);
		context->Global()->Set(context,
			v8::String::NewFromUtf8(isolate_, block_timestamp_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
			timestamp_v8);

		if (CHECK_VERSION_GT_1001) {
			auto string_origin_sender = v8::String::NewFromUtf8(isolate_, parameter_.ledger_context_->GetBottomTx()->GetOperatingSourceAddress().c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, origin_sender_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				string_origin_sender);

			auto tx_initiator = v8::String::NewFromUtf8(isolate_, parameter_.tx_initiator_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, tx_initiator_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				tx_initiator);

			auto string_origin_tx_initiator = v8::String::NewFromUtf8(isolate_, parameter_.ledger_context_->GetBottomTx()->GetSourceAddress().c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			context->Global()->Set(context,
				v8::String::NewFromUtf8(isolate_, origin_tx_initiator_name_.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				string_origin_tx_initiator);
		}

		v8::Local<v8::String> v8src = v8::String::NewFromUtf8(isolate_, parameter_.code_.c_str());
		v8::Local<v8::Script> compiled_script;

		Json::Value error_desc_f;
		Json::Value temp_result;
		do {
			if (!RemoveRandom(isolate_, error_desc_f)) {
				break;
			}

			v8::Local<v8::String> check_time_name(
				v8::String::NewFromUtf8(context->GetIsolate(), "__enable_check_time__",
				v8::NewStringType::kNormal).ToLocalChecked());
			v8::ScriptOrigin origin_check_time_name(check_time_name);

			if (!v8::Script::Compile(context, v8src, &origin_check_time_name).ToLocal(&compiled_script)) {
				error_desc_f = ReportException(isolate_, &try_catch);
				break;
			}

			v8::Local<v8::Value> result;
			if (!compiled_script->Run(context).ToLocal(&result)) {
				error_desc_f = ReportException(isolate_, &try_catch);
				break;
			}

			v8::Local<v8::String> process_name = v8::String::NewFromUtf8(
				isolate_, query_name_, v8::NewStringType::kNormal, strlen(query_name_)).ToLocalChecked();

			v8::Local<v8::Value> process_val;
			if (!context->Global()->Get(context, process_name).ToLocal(&process_val) ||
				!process_val->IsFunction()) {
				Json::Value &exception = error_desc_f["exception"];
				exception = utils::String::Format("Lost of %s function", query_name_);
				LOG_ERROR("%s", exception.asCString());
				break;
			}

			v8::Local<v8::Function> process = v8::Local<v8::Function>::Cast(process_val);

			const int argc = 1;
			v8::Local<v8::Value>  argv[argc];
			v8::Local<v8::String> arg1 = v8::String::NewFromUtf8(isolate_, parameter_.input_.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
			argv[0] = arg1;

			v8::Local<v8::Value> callRet;
			if (!process->Call(context, context->Global(), argc, argv).ToLocal(&callRet)) {
				error_desc_f = ReportException(isolate_, &try_catch);
				LOG_ERROR("Failed to execute %s function.", query_name_);
				break;
			}

			JsValueToCppJson(context, callRet, temp_result);
			js_result["result"] = temp_result;
			return true;
		} while (false);

		Json::Value &error_obj = js_result["error"];
		error_obj["data"] = error_desc_f;
		return false;
	}


	V8Contract *V8Contract::GetContractFrom(v8::Isolate* isolate) {
		utils::MutexGuard guard(isolate_to_contract_mutex_);
		std::unordered_map<v8::Isolate*, V8Contract *>::iterator iter = isolate_to_contract_.find(isolate);
		if (iter != isolate_to_contract_.end()) {
			return iter->second;
		}

		return NULL;
	}

	bool V8Contract::RemoveRandom(v8::Isolate* isolate, Json::Value &error_msg) {
		v8::TryCatch try_catch(isolate);
		std::string js_file = "delete String.prototype.localeCompare; delete Date; delete Math;";

		v8::Local<v8::String> source = v8::String::NewFromUtf8(isolate, js_file.c_str());
		v8::Local<v8::Script> script;

		v8::Local<v8::String> check_time_name(
			v8::String::NewFromUtf8(isolate->GetCurrentContext()->GetIsolate(), "__enable_check_time__",
			v8::NewStringType::kNormal).ToLocalChecked());
		v8::ScriptOrigin origin_check_time_name(check_time_name);

		if (!v8::Script::Compile(isolate->GetCurrentContext(), source, &origin_check_time_name).ToLocal(&script)) {
			error_msg = ReportException(isolate, &try_catch);
			return false;
		}

		v8::Local<v8::Value> result;
		if (!script->Run(isolate->GetCurrentContext()).ToLocal(&result)) {
			error_msg = ReportException(isolate, &try_catch);
			return false;
		}

		return true;
	}

	v8::Local<v8::Context> V8Contract::CreateContext(v8::Isolate* isolate, bool readonly) {
		// Create a template for the global object.
		v8::Local<v8::ObjectTemplate> global = v8::ObjectTemplate::New(isolate);
		std::map<std::string, v8::FunctionCallback>::iterator itr;
		for (itr = js_func_read_.begin(); itr != js_func_read_.end(); itr++) {
			global->Set(v8::String::NewFromUtf8(isolate, itr->first.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				v8::FunctionTemplate::New(isolate, itr->second));
		}
		if (!readonly) {
			for (itr = js_func_write_.begin(); itr != js_func_write_.end(); itr++) {
				global->Set(v8::String::NewFromUtf8(isolate, itr->first.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
					v8::FunctionTemplate::New(isolate, itr->second));
			}
		}

		if (CHECK_VERSION_GT_1001) {
			InitFuncTemplateGt1001(isolate, global, readonly);
		}

		return v8::Context::New(isolate, NULL, global);
	}

	void V8Contract::InitFuncTemplateGt1001(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> global, bool readonly) {
		// Init function template when ledger greater than 1001
		std::map<std::string, v8::FunctionCallback>::iterator itr;
		for (itr = js_func_read_gt1001_.begin(); itr != js_func_read_gt1001_.end(); itr++) {
			global->Set(v8::String::NewFromUtf8(isolate, itr->first.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
				v8::FunctionTemplate::New(isolate, itr->second));
		}
		if (!readonly) {
			for (itr = js_func_write_gt1001_.begin(); itr != js_func_write_gt1001_.end(); itr++) {
				global->Set(v8::String::NewFromUtf8(isolate, itr->first.c_str(), v8::NewStringType::kNormal).ToLocalChecked(),
					v8::FunctionTemplate::New(isolate, itr->second));
			}
		}
	}

	Json::Value V8Contract::ReportException(v8::Isolate* isolate, v8::TryCatch* try_catch) {
		v8::HandleScope handle_scope(isolate);
		v8::String::Utf8Value exception(try_catch->Exception());
		const char* exception_string = ToCString(exception);
		std::string exec_string(exception_string);
		exec_string.resize(256);
		Json::Value json_result;

		std::string contract_address = "";
		V8Contract *v8_contract = GetContractFrom(isolate);
		if (v8_contract != nullptr) {
			contract_address = v8_contract->parameter_.this_address_;
		}

		v8::Local<v8::Message> message = try_catch->Message();
		std::string error_msg;
		if (message.IsEmpty()) {
			// V8 didn't provide any extra information about this error; just
			// print the exception.
			json_result["exception"] = exec_string;
			json_result["contract"] = contract_address;
		}
		else {
			// Print (filename):(line number): (message).
			v8::String::Utf8Value filename(message->GetScriptOrigin().ResourceName());
			v8::Local<v8::Context> context(isolate->GetCurrentContext());
			const char* filename_string = ToCString(filename);
			int linenum = message->GetLineNumber(context).FromJust();
			//json_result["filename"] = filename_string;
			json_result["linenum"] = linenum;
			json_result["exception"] = exec_string;
			json_result["contract"] = contract_address;

			//Print error stack
			v8::Local<v8::Value> stack_trace_string;
			if (try_catch->StackTrace(context).ToLocal(&stack_trace_string) &&
				stack_trace_string->IsString() &&
				v8::Local<v8::String>::Cast(stack_trace_string)->Length() > 0) {
				v8::String::Utf8Value stack_trace(stack_trace_string);
				const char* stack_trace_string = ToCString(stack_trace);
				json_result["stack"] = stack_trace_string;
			}
		}

		LOG_ERROR("Faild to execute script: %s", json_result.toFastString().c_str());
		return json_result;
	}

	bool V8Contract::CppJsonToJsValue(v8::Isolate* isolate,const Json::Value& jsonvalue, v8::Local<v8::Value>& jsvalue) {
		std::string type = jsonvalue["type"].asString();
		if (type == "string") {
			jsvalue = v8::String::NewFromUtf8(isolate, jsonvalue["value"].asCString());
		}
		else if (type == "bool") {
			jsvalue = v8::Boolean::New(isolate, jsonvalue["value"].asBool());
		}

		return true;
	}

	bool V8Contract::JsValueToCppJson(v8::Handle<v8::Context>& context, v8::Local<v8::Value>& jsvalue, Json::Value& jsonvalue) {
		if (jsvalue->IsBoolean()) {
			jsonvalue["type"] = "bool";
			jsonvalue["value"] = jsvalue->BooleanValue();
		}
		else if (jsvalue->IsString()) {
			jsonvalue["type"] = "string";
			jsonvalue["value"] = std::string(ToCString(v8::String::Utf8Value(jsvalue)));
		}
		else {
			jsonvalue["type"] = "bool";
			jsonvalue["value"] = false;
		}

		return true;
	}

	V8Contract* V8Contract::UnwrapContract(v8::Local<v8::Object> obj) {
		v8::Local<v8::External> field = v8::Local<v8::External>::Cast(obj->GetInternalField(0));
		void* ptr = field->Value();
		return static_cast<V8Contract*>(ptr);
	}

	const char* V8Contract::ToCString(const v8::String::Utf8Value& value) {
		return *value ? *value : "<string conversion error>";
	}

	void V8Contract::Include(const v8::FunctionCallbackInfo<v8::Value>& args) {
		do {
			if (args.Length() != 1) {
				LOG_TRACE("Including parameter error, the length(%d) of args is not equal 1", args.Length());
				args.GetReturnValue().Set(false);
				break;
			}

			if (!args[0]->IsString()) {
				LOG_TRACE("Including parameter error, parameter should be a String");
				args.GetReturnValue().Set(false);
				break;
			}
			v8::String::Utf8Value str(args[0]);

			std::map<std::string, std::string>::iterator find_source = jslib_sources_.find(*str);
			if (find_source == jslib_sources_.end()) {
				LOG_TRACE("Failed to find the include file(%s) in jslib directory", *str);
				args.GetReturnValue().Set(false);
				break;
			}

			v8::TryCatch try_catch(args.GetIsolate());
			std::string js_file = find_source->second; //load_file(*str);

			v8::Local<v8::String> source = v8::String::NewFromUtf8(args.GetIsolate(), js_file.c_str());
			v8::Local<v8::Script> script;

			v8::Local<v8::String> check_time_name(
				v8::String::NewFromUtf8(args.GetIsolate()->GetCurrentContext()->GetIsolate(), "__enable_check_time__",
				v8::NewStringType::kNormal).ToLocalChecked());
			v8::ScriptOrigin origin_check_time_name(check_time_name);

			if (!v8::Script::Compile(args.GetIsolate()->GetCurrentContext(), source, &origin_check_time_name).ToLocal(&script)) {
				ReportException(args.GetIsolate(), &try_catch);
				break;
			}

			v8::Local<v8::Value> result;
			if (!script->Run(args.GetIsolate()->GetCurrentContext()).ToLocal(&result)) {
				ReportException(args.GetIsolate(), &try_catch);
			}
		} while (false);
		//return v8::Undefined(args.GetIsolate());
	}

	void V8Contract::InternalCheckTime(const v8::FunctionCallbackInfo<v8::Value>& args) {
		bumo::AccountFrm::pointer account_frm = nullptr;
		V8Contract *v8_contract = GetContractFrom(args.GetIsolate());

		if (v8_contract && v8_contract->GetParameter().ledger_context_) {
			LedgerContext *ledger_context = v8_contract->GetParameter().ledger_context_;
			TransactionFrm::pointer ptr = ledger_context->GetBottomTx();
			ptr->ContractStepInc(1);

			//Check the storage
			v8::HeapStatistics stats;
			args.GetIsolate()->GetHeapStatistics(&stats);
			ptr->SetMemoryUsage(stats.used_heap_size());

			//Check the stack
			v8::V8InternalInfo internal_info;
			args.GetIsolate()->GetV8InternalInfo(internal_info);

			ptr->SetStackRemain(internal_info.remain_stack_size);
			//LOG_INFO("v8 remain stack:%d, now step:%d\n", internal_info.remain_stack_size, ptr->GetContractStep());

			std::string error_info;
			if (ptr->IsExpire(error_info)) {
				args.GetIsolate()->ThrowException(
					v8::String::NewFromUtf8(args.GetIsolate(), error_info.c_str(),
					v8::NewStringType::kNormal).ToLocalChecked());
			}
		}

	}

	bool V8Contract::TransEncodeType(const v8::Local<v8::Value> &arg, DataEncodeType &data_type) {
		if (!arg->IsNumber()) {
			LOG_TRACE("Contract execution error, parameter should be a number.");
			return false;
		}

		std::string arg_str = ToCString(v8::String::Utf8Value(arg));
		int64_t arg_num = 0;
		if (!utils::String::SafeStoi64(arg_str, arg_num)) {
			LOG_TRACE("Contract execution error, encode type maybe exceed the limit value of int64.");
			return false;
		}
		if (arg_num < 0 || arg_num > BASE64) {
			LOG_TRACE("Contract execution error, encode type must be in 0-2");
			return false;
		}
		data_type = (DataEncodeType)arg_num;
		return true;
	}

	bool V8Contract::TransEncodeData(const v8::Local<v8::Value> &raw_data, const DataEncodeType &encode_type, std::string &result_data) {
		result_data.clear();
		std::string input_raw = ToCString(v8::String::Utf8Value(raw_data));
		switch (encode_type) {
		case BASE16:{
			result_data = utils::String::HexStringToBin(input_raw);
			break;
		}
		case RAW_DATA:{
			result_data = input_raw;
			break;
		}
		case BASE64:{
			utils::Base64Decode(input_raw, result_data);
			break;
		}
		default:
			break;
		}

		if (result_data.empty()) {
			LOG_TRACE("TransEncodeData error");
			return false;
		}
		return true;
	}

}
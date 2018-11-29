#include "gtest/gtest.h"
#include "utils/base64.h"

class Base64Test : public testing::Test{
protected:

	// Sets up the test fixture.
	virtual void SetUp(){
	}

	// Tears down the test fixture.
	virtual void TearDown(){

	}

private:

protected:
	void UT_BASE64_ENCODE();
};

TEST_F(Base64Test, UT_BASE64_ENCODE){ UT_BASE64_ENCODE(); }

void Base64Test::UT_BASE64_ENCODE(){
	{
		char data[] = { 'A', 'b', 0x00, 'c', 'd' };
		std::string input_str(data, sizeof(data));
		std::string encode_str;
		std::string decode_str;
		EXPECT_EQ(utils::Base64Encode(input_str, encode_str), true);
		EXPECT_EQ(utils::Base64Decode(encode_str, decode_str), true);
		EXPECT_EQ(input_str.compare(decode_str), 0);
	}

	{
		std::string input_str("1234");
		std::string encode_str;
		std::string decode_str;
		EXPECT_EQ(utils::Base64Encode(input_str, encode_str), true);
		EXPECT_EQ(utils::Base64Decode(encode_str, decode_str), true);
		EXPECT_EQ(input_str.compare(decode_str), 0);
	}

	{
		std::string input_str("12346");
		//std::string encode_str;
		std::string decode_str;
		//EXPECT_EQ(utils::Base64Encode(input_str, encode_str), false);
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
		//EXPECT_EQ(input_str.compare(decode_str), 0);
	}
	
	{
		std::string input_str("²¼±È");
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
	}

	{
		char data[] = { 'A', 'b', 0x00, 'c' };
		std::string input_str(data, sizeof(data));
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
	}

	{
		char data[] = { 'A', 'b', 0x05, 'c' };
		std::string input_str(data, sizeof(data));
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
	}

	{
		char data[] = { 'A', 'b', 0x25, 'c' };
		std::string input_str(data, sizeof(data));
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
	}

	{
		char data[] = { 'A', 'b', 0x31, 'c' };
		std::string input_str(data, sizeof(data));
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), true);
	}

	{
		char data[] = { 'A', 'b', 0x31, 'c', '1' };
		std::string input_str(data, sizeof(data));
		std::string decode_str;
		EXPECT_EQ(utils::Base64Decode(input_str, decode_str), false);
	}

	printf("\n");
}

/**
 * FormulaParserUtil - 公式解析工具类
 * 
 * 基于 FormulaExplainer 逻辑，用于解析公式计算结果
 * 支持解析公式中的可视化元素：参数、形状、颜色等
 * 支持 WASM 模块集成，提供高性能数据处理能力
 * 
 * @version 2.0
 * @author Auto-generated from FormulaExplainer patterns with WASM integration
 */

class FormulaParserUtil {
  /**
   * 构造函数 - 需要 wasmModule 参数
   * @param {Object} wasmModule - WASM 模块实例
   */
  constructor(wasmModule) {
    if (!wasmModule) {
      throw new Error('FormulaParserUtil: WASM module is required');
    }
    
    this.wasmModule = wasmModule;
    this._validateWasmModule();
  }

  /**
   * 验证 WASM 模块的可用性
   * @private
   */
  _validateWasmModule() {
    // 检查公式相关的必需类
    const requiredFormulaClasses = [
      'FormulaVariableType',
      'FormulaChartType'
    ];

    for (const className of requiredFormulaClasses) {
      if (!this.wasmModule[className]) {
        throw new Error(`FormulaParserUtil: Required WASM class ${className} not found`);
      }
    }
    
    console.log('FormulaParserUtil: WASM module validated successfully');
  }

  /**
   * 创建 FormulaParserUtil 实例的静态工厂方法
   * @param {Object} wasmModule - WASM 模块实例
   * @returns {FormulaParserUtil} 实例
   */
  static create(wasmModule) {
    return new FormulaParserUtil(wasmModule);
  }
  /**
   * 颜色映射表
   */
  static colorMap = {
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'white': '#FFFFFF',
    'black': '#000000',
    'gray': '#808080',
    'orange': '#FFA500',
    'purple': '#800080',
    'pink': '#FFC0CB',
    'brown': '#A52A2A',
    'lime': '#00FF00',
    'navy': '#000080',
    'teal': '#008080',
    'olive': '#808000',
    'maroon': '#800000'
  };

  /**
   * 透明度转换规则
   * @param {number} hex - 十六进制透明度值
   * @returns {number} 百分比透明度
   */
  static rule(hex) {
    return Math.round((hex / 255) * 100);
  }

  /**
   * 反向透明度转换规则
   * @param {number} percentage - 百分比透明度
   * @returns {string} 十六进制透明度值
   */
  static rule2(percentage) {
    const hex = Math.round((percentage / 100) * 255).toString(16).padStart(2, '0');
    return hex.toUpperCase();
  }

  /**
   * 临时分隔符
   */
  static temp_delimiter = "<thisistempdelimiter>;";

  /**
   * 将源代码按块拆分
   * @param {string} sourcecode - 源代码
   * @returns {Array} 代码块数组
   */
  static splitToBlocks(sourcecode) {
    let blocks = sourcecode.split(";");
    // 关键字 if endif else if when 含 [\s\S]
    let d = /(if.*?then|endif|else if.*then)/gi;
    blocks = sourcecode.replace(d, "$1" + FormulaParserUtil.temp_delimiter).split(";");
    return blocks;
  }

  /**
   * 验证代码是否有效
   * @param {string} code - 代码字符串
   * @returns {boolean} 是否有效
   */
  static isValid(code) {
    let valid = true;
    if (code.indexOf(FormulaParserUtil.temp_delimiter) !== -1) {
      valid = false;
    }
    return valid;
  }

  /**
   * 解析公式源代码，提取参数和形状信息
   * @param {string} sourcecode - 公式源代码
   * @returns {Object} 解析结果
   */
  static parseFormulaSource(sourcecode) {
    const color_prefix = "#";
    const blocks = FormulaParserUtil.splitToBlocks(sourcecode).map((line, index) => {
      return {
        lineNo: index,
        line: line.trim(),
      };
    });

    const parameters = [];
    const shapes = [];
    let doodle_label_cnt = 0;
    let doodle_line_cnt = 0;

    blocks.forEach(line => {
      const variableRegex = /(variable)/i;
      const colorRegex = /(color)/i;
      const barRegex = /(stickline)/i;
      const lineRegex = /(linethick)/i;
      const styleRegex = /style[:]?([a-z)]+)/i;

      let code = line.line;
      code = code.replace(/\s/g, "");
      
      if (!FormulaParserUtil.isValid(code)) return;

      const lineNo = line.lineNo;
      let opacity = "100%";
      let opacity_mode = 0; // 0:No 1:color 2:opacity

      // 解析简单变量
      if (variableRegex.test(code)) {
        const m = code.match(/^variable:(.*)/i);
        if (m) {
          const variablesPart = m[1];
          if (variablesPart) {
            const variables = variablesPart.split(",");
            variables.forEach(v => {
              const tmp = v.split("=");
              const val_exp = new RegExp("^" + tmp[0] + "\\s*:=\\s*(.*)");
              let val = tmp[1];
              let line_no = lineNo;

              const val_line_arr = blocks.filter(line => {
                return val_exp.test(line.line);
              });

              if (val_line_arr.length > 0) {
                const val_line = val_line_arr[val_line_arr.length - 1];
                if (val_line.line && val_line.line.match(val_exp)) {
                  const match = val_line.line.match(val_exp);
                  if (match && Number(match[1])) {
                    val = Number(match[1]);
                    line_no = val_line.lineNo;
                  }
                }
              }

              parameters.push({ 
                lineNo: line_no, 
                parameter: tmp[0], 
                value: val 
              });
            });
          }
        }
      } else {
        const dLineRegex = /^line\([^,]+,[^,]+,[^,]*,[^,]*,(\S*)\)$/i;
        const labelRegex = /^label\([^,]+,[^,]+,(\S+)\)$/i;

        // 涂鸦线条
        if (dLineRegex.test(code)) {
          const shape = {
            type: "doodle_line",
            name: "DLine" + doodle_line_cnt++,
            lineNo: lineNo,
          };

          const pieces = dLineRegex.exec(code);
          if (pieces && pieces[1]) {
            let piecesStr = pieces[1];
            piecesStr = piecesStr.replaceAll(/[\:|\"|\#]/g, "").toLowerCase();

            const colorMatch = piecesStr.match(/color[#]?([^,]+),?/i);
            if (colorMatch) {
              let color = colorMatch[1];
              if (FormulaParserUtil.colorMap[color]) {
                shape.color = FormulaParserUtil.colorMap[color];
              } else {
                if (color.length === 8) {
                  opacity = FormulaParserUtil.rule(parseInt(color.slice(-2), 16)).toFixed(2) + "%";
                  opacity_mode = 1;
                  color = color.slice(0, 6);
                }
                shape.color = color_prefix + color;
              }
            }

            shape.opacity = opacity;
            shape.opacity_mode = opacity_mode;

            const widthMatch = piecesStr.match(/linethick([^,]+),?/i);
            if (widthMatch) {
              shape.lineThick = widthMatch[1];
            }

            let style = "line";
            const styleMatch = piecesStr.match(styleRegex);
            if (styleMatch && styleMatch[1]) {
              style = styleMatch[1];
            }
            shape.style = style;

            shapes.push(shape);
          }
        } 
        // 涂鸦标签
        else if (labelRegex.test(code)) {
          const shape = {
            type: "doodle_label",
            name: "DLabel" + doodle_label_cnt++,
            lineNo: lineNo,
          };

          const pieces = labelRegex.exec(code);
          if (pieces && pieces[1]) {
            let piecesStr = pieces[1];
            piecesStr = piecesStr.replaceAll(/[\:|\"|\#]/g, "").toLowerCase();

            const colorMatch = piecesStr.match(/color[#]?([^,|^'|^"]+),?/i);
            if (colorMatch) {
              let color = colorMatch[1];
              if (FormulaParserUtil.colorMap[color]) {
                shape.color = FormulaParserUtil.colorMap[color];
              } else {
                if (color.length === 8) {
                  opacity = FormulaParserUtil.rule(parseInt(color.slice(-2), 16)).toFixed(2) + "%";
                  opacity_mode = 1;
                  color = color.slice(0, 6);
                }
                shape.color = color_prefix + color;
              }
            }

            shape.opacity = opacity;
            shape.opacity_mode = opacity_mode;

            const widthMatch = piecesStr.match(/linethick([^,]+),?/i);
            shape.lineThick = widthMatch ? widthMatch[1] : 1;

            const fontMatch = piecesStr.match(/font([^,]+),?/i);
            shape.font = fontMatch ? Number(fontMatch[1]) : 10;

            const bcolorMatch = piecesStr.match(/bcolor([^,]+),?/i);
            if (bcolorMatch) {
              let bcolor = bcolorMatch[1];
              if (FormulaParserUtil.colorMap[bcolor]) {
                shape.bcolor = FormulaParserUtil.colorMap[bcolor];
              } else {
                if (bcolor.length === 8) {
                  const bopacity = FormulaParserUtil.rule(parseInt(bcolor.slice(-2), 16)).toFixed(2) + "%";
                  shape.bopacity = bopacity;
                  bcolor = bcolor.slice(0, 6);
                }
                shape.bcolor = color_prefix + bcolor;
              }
            }

            const bopacityMatch = piecesStr.match(/bopacity([^,]+),?/i);
            if (bopacityMatch) {
              shape.bopacity = bopacityMatch[1];
              shape.bopacity_mode = 2;
            }

            shapes.push(shape);
          }
        } 
        // 柱状图 (stickline)
        else if (barRegex.test(code)) {
          code = code.toLowerCase();
          const nameMatch = code.match(/^(.*):/);
          const name = nameMatch ? nameMatch[1] : code.split(":")[0];

          const shape = { 
            type: "bar", 
            lineNo: lineNo, 
            name: name 
          };

          const colorMatch = code.match(/color[:]?[#]?(.*)/i);
          if (colorMatch) {
            let color = colorMatch[1].split(",")[0];
            color = color.replace(":", "");

            if (FormulaParserUtil.colorMap[color]) {
              shape.color = FormulaParserUtil.colorMap[color];
            } else {
              if (color.length === 8) {
                opacity = FormulaParserUtil.rule(parseInt(color.slice(-2), 16)).toFixed(2) + "%";
                opacity_mode = 1;
                color = color.slice(0, 6);
              }
              shape.color = color_prefix + color;
            }
          }

          shape.opacity = opacity;
          shape.opacity_mode = opacity_mode;
          shapes.push(shape);
        } 
        // 线条图 (linethick)
        else if (lineRegex.test(code)) {
          code = code.toLowerCase();
          const nameMatch = code.match(/^(.*):/);
          const name = nameMatch ? nameMatch[1] : code.split(":")[0];

          const shape = { 
            type: "line", 
            lineNo: lineNo, 
            name: name 
          };

          const colorMatch = code.match(/color[:]?[#]?(.*)/i);
          const widthMatch = code.match(/linethick[:]?(.*)/i);

          if (colorMatch) {
            let color = colorMatch[1].split(",")[0];
            if (FormulaParserUtil.colorMap[color]) {
              shape.color = FormulaParserUtil.colorMap[color];
            } else {
              if (color.length === 8) {
                opacity_mode = 1;
                opacity = FormulaParserUtil.rule(parseInt(color.slice(-2), 16)).toFixed(2) + "%";
                color = color.slice(0, 6);
              }
              shape.color = color_prefix + color;
            }
          }

          let style = "line";
          const styleMatch = code.match(styleRegex);
          if (styleMatch && styleMatch[1]) {
            style = styleMatch[1];
          }

          shape.style = style;
          shape.opacity = opacity;
          shape.opacity_mode = opacity_mode;
          shape.lineThick = widthMatch ? widthMatch[1].split(",")[0] : 1;
          shapes.push(shape);
        } 
        // 颜色设置
        else if (colorRegex.test(code)) {
          code = code.toLowerCase();
          const nameMatch = code.match(/^(.*):/);
          const name = nameMatch ? nameMatch[1] : code.split(":")[0];

          const shape = { 
            type: "line", 
            lineNo: lineNo, 
            name: name 
          };

          const colorMatch = code.match(/color[:]?[#]?(.*)/i);
          if (colorMatch) {
            let color = colorMatch[1].split(",")[0];
            if (FormulaParserUtil.colorMap[color]) {
              shape.color = FormulaParserUtil.colorMap[color];
            } else {
              if (color.length === 8) {
                opacity_mode = 1;
                opacity = FormulaParserUtil.rule(parseInt(color.slice(-2), 16)).toFixed(2) + "%";
                color = color.slice(0, 6);
              }
              shape.color = color_prefix + color;
            }
          }

          let style = "line";
          const styleMatch = code.match(styleRegex);
          if (styleMatch && styleMatch[1]) {
            style = styleMatch[1];
          }

          shape.style = style;
          shape.opacity = opacity;
          shape.opacity_mode = opacity_mode;
          shape.lineThick = 1;
          shapes.push(shape);
        }
      }
    });

    return {
      parameters: parameters,
      shapes: shapes,
      sourcecode: sourcecode
    };
  }

  /**
   * 获取变量类型对应的访问函数名
   * @param {Object} variableType - 变量类型对象
   * @param {Object} wasmModule - WASM 模块实例
   * @returns {string} 函数名
   */
  static getFuncName(variableType, wasmModule) {
    if (!wasmModule || !wasmModule.FormulaVariableType) {
      throw new Error('FormulaParserUtil: WASM module with FormulaVariableType is required');
    }
    const FormulaVariableType = wasmModule.FormulaVariableType;
    let funcName = "";
    switch (variableType) {
      case FormulaVariableType.DOUBLE:
        funcName = "doubleVectorAt";
        break;
      case FormulaVariableType.INTEGER:
        funcName = "int32VectorAt";
        break;
      case FormulaVariableType.BOOLEAN:
        funcName = "booleanVectorAt";
        break;
      case FormulaVariableType.STRING:
        funcName = "stringVectorAt";
        break;
      case FormulaVariableType.DEFINITION:
        funcName = "doubleVectorVectorAt";
        break;
      default:
        throw new Error(`FormulaParserUtil: Unknown variable type ${variableType.value}`);
    }
    
    return funcName;
  }

  /**
   * 实例方法版本的 getFuncName，使用实例的 wasmModule
   * @param {Object} variableType - 变量类型对象
   * @returns {string} 函数名
   */
  getFuncName(variableType) {
    return FormulaParserUtil.getFuncName(variableType, wasmModule);
  }

  /**
   * 生成样式配置
   * @param {string} p - 样式字符串
   * @param {Object} res - 结果对象
   * @returns {Object} 更新后的样式对象
   */
  static generateStyle(p, res) {
    const _rule = FormulaParserUtil.rule;
    p = p.trim();
    
    if (p.toUpperCase().indexOf("COLOR") !== -1) {
      let split_index = 5;
      if (p.toUpperCase().indexOf("COLOR:") !== -1) {
        split_index = 6;
      }
      let piece = p.slice(split_index).toLowerCase();
      if (piece.length === 8) {
        res.opacity = _rule(parseInt(p.slice(-2), 16)).toFixed(2) + "%";
        piece = p.slice(split_index, -2);
      }
      if (FormulaParserUtil.colorMap[piece]) {
        res.color = FormulaParserUtil.colorMap[piece];
      } else {
        res.color = "#" + piece;
      }
    }

    if (p.toUpperCase().indexOf("LINETHICK") !== -1) {
      let split_index = 9;
      if (p.toUpperCase().indexOf("LINETHICK:") !== -1) {
        split_index = 10;
      }
      res.width = parseInt(p.slice(split_index));
    }

    if (p.toUpperCase().indexOf("STYLE") !== -1) {
      let split_index = 5;
      if (p.toUpperCase().indexOf("STYLE:") !== -1) {
        split_index = 6;
      }
      res.style = String(p.slice(split_index));
    }
    
    return res;
  }

  /**
   * 生成字体样式配置
   * @param {string} p - 样式字符串
   * @param {Object} res - 结果对象
   * @returns {Object} 更新后的样式对象
   */
  static generateFontStyle(p, res) {
    p = p.replace(/\s+/g, "");
    const colorE = /^COLOR[:]?[#]?([0-9A-F]{6,8})$/i;
    const bColorE = /^BCOLOR[:]?[#]?([0-9A-F]{6,8})$/i;
    
    if (colorE.test(p)) {
      let piece = colorE.exec(p)[1];
      if (piece.length === 8) {
        res.opacity = FormulaParserUtil.rule(parseInt(p.slice(-2), 16)).toFixed(2) + "%";
        piece = piece.slice(0, 6);
      }
      if (FormulaParserUtil.colorMap[piece]) {
        res.color = FormulaParserUtil.colorMap[piece];
      } else {
        res.color = "#" + piece;
      }
    }
    
    if (p.toUpperCase().indexOf("LINETHICK") !== -1) {
      let split_index = 9;
      if (p.toUpperCase().indexOf("LINETHICK:") !== -1) {
        split_index = 10;
      }
      res.width = parseInt(p.slice(split_index));
    }
    
    if (p.toUpperCase().indexOf("STYLE") !== -1) {
      let split_index = 5;
      if (p.toUpperCase().indexOf("STYLE:") !== -1) {
        split_index = 6;
      }
      res.style = String(p.slice(split_index));
    }
    
    if (p.toUpperCase().indexOf("FONT") !== -1) {
      let split_index = 4;
      if (p.toUpperCase().indexOf("FONT:") !== -1) {
        split_index = 5;
      }
      res.font = String(p.slice(split_index));
    }
    
    if (bColorE.test(p)) {
      let piece = bColorE.exec(p)[1];
      if (piece.length === 8) {
        res.bopacity = FormulaParserUtil.rule(parseInt(p.slice(-2), 16)).toFixed(2) + "%";
        piece = piece.slice(0, 6);
      }
      if (FormulaParserUtil.colorMap[piece]) {
        res.bcolor = FormulaParserUtil.colorMap[piece];
      } else {
        res.bcolor = "#" + piece;
      }
    }
    
    if (p.toUpperCase().indexOf("BOPACITY") !== -1) {
      let split_index = 8;
      if (p.toUpperCase().indexOf("BOPACITY:") !== -1) {
        split_index = 9;
      }
      res.bopacity = String(p.slice(split_index));
    }

    return res;
  }

  /**
   * 验证涂鸦位置是否有效
   * @param {Array} pos - 位置数组
   * @param {Array} ranges - 范围数组
   * @returns {boolean} 是否有效
   */
  static isValidDoodle(pos, ranges) {
    let valid = true;
    let min = ranges[0];
    let max = ranges[ranges.length - 1];
    pos.forEach(p => {
      if (p < min || p > max) {
        valid = false;
      }
    });
    return valid;
  }

  /**
   * 处理公式计算结果 - 基于 FormulaResultUtil 的逻辑
   * @param {Object} calRes - 公式计算响应对象
   * @param {string} sourcecode - 公式源代码（可选）
   * @param {Object} wasmModule - WASM 模块实例
   * @returns {Object} 处理后的结果
   */
  static processFormulaResults(calRes, sourcecode = null, wasmModule) {
    if (!wasmModule) {
      throw new Error('FormulaParserUtil: WASM module is required for processFormulaResults');
    }
    const results = {
      charts: [],
      doodles: [],
      parameters: [],
      shapes: [],
      displayConfiguration: {},
      data: [],
      metadata: {
        totalCharts: 0,
        totalDoodles: 0,
        hasSourcecode: !!sourcecode
      }
    };

    try {
      // 提取时间标签
      let time_tags = [];
      if (calRes.timeTags && calRes.timeTags.size) {
        for (let i = 0; i < calRes.timeTags.size(); i++) {
          time_tags.push(+calRes.timeTags.get(i));
        }
      }

      let fields = [];
      let schema = [];
      let values = [];
      let displayConfiguration = {};
      const count = time_tags.length;
      let anonymousCnt = 0;

      // 添加时间标签到 schema 和 values
      if (count > 0) {
        values.push(time_tags, time_tags, time_tags, time_tags);
        schema.push("time_tag", "time_tag", "time_tag", "time_tag");
      }

      // 处理图表数据
      if (calRes.charts && calRes.charts.size && calRes.charts.size() > 0) {
        results.metadata.totalCharts = calRes.charts.size();
        
        for (let i = 0; i < calRes.charts.size(); i++) {
          const c = calRes.charts.get(i);
          const name = c.name || "anonymous" + anonymousCnt++;
          const properties = c.properties;
          let style = { color: "black", width: 1, opacity: "100%", style: "solid" };
          
          // 处理属性样式
          if (properties && properties.size) {
            for (let j = 0; j < properties.size(); j++) {
              const p = properties.get(j);
              FormulaParserUtil.generateStyle(p, style);
            }
          }
          // 根据图表类型处理
          if (c.type.value === 0) { // POLYLINE
            fields.push({
              name: name,
              precision: 5,
              type_id: 2,
            });
            schema.push(name);
            
            const func = FormulaParserUtil.getFuncName(c.variableTypes.get(0),wasmModule);
            let vs = [];
            if (func === "doubleVectorVectorAt") {
              const ds = c[func](0);
              for (let j = 0; j < ds.size(); j++) {
                const vss = [];
                for (let k = 0; k < ds.get(j).size(); k++) {
                  vss.push(ds.get(j).get(k));
                }
                vs.push(vss);
              }
              values.push(vs);
              displayConfiguration[name] = {
                name: name,
                src: name,
                line_style: "forecast_ruler",
                display: {
                  color: style.color,
                  width: style.width,
                  opacity: style.opacity,
                  style: style.style,
                },
              };
            } else {
              const ds = c[func](0);
              for (let j = 0; j < ds.size(); j++) {
                vs.push(ds.get(j));
              }
              values.push(vs);
              displayConfiguration[name] = {
                line_style: "polyline",
                display: {
                  color: style.color,
                  width: style.width,
                  opacity: style.opacity,
                  style: style.style,
                },
                src: name,
                name: name,
              };
            }
          } else if (c.type.value === 1) { // BAR
            if (c.functionName === "stickline") {
              // 处理 stickline 的多个字段
              const fieldNames = ["_cond", "_price1", "_price2", "_width", "_attr"];
              for (let fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex++) {
                const fieldName = name + fieldNames[fieldIndex];
                fields.push({
                  name: fieldName,
                  precision: fieldIndex === 0 ? 0 : 5,
                  type_id: fieldIndex === 0 ? 1 : 2,
                });
                schema.push(fieldName);
                
                const func = FormulaParserUtil.getFuncName(c.variableTypes.get(fieldIndex), wasmModule);
                const ds = c[func](fieldIndex);
                const vs = [];
                for (let j = 0; j < ds.size(); j++) {
                  vs.push(ds.get(j));
                }
                values.push(vs);
              }
              
              displayConfiguration[name] = {
                line_style: "bar",
                display: {
                  color: style.color,
                },
                src: {
                  cond: name + "_cond",
                  price1: name + "_price1",
                  price2: name + "_price2",
                  width: name + "_width",
                },
                name: name,
              };
            }
          } else if (c.type.value === 2) { // FUTURELINE
            fields.push({
              name: name,
              precision: 5,
              type_id: 2,
            });
            schema.push(name);
            
            const func = FormulaParserUtil.getFuncName(c.variableTypes.get(0), wasmModule);
            let vs = [];
            
            if (func === "doubleVectorVectorAt") {
              const ds = c[func](0);
              for (let j = 0; j < ds.size(); j++) {
                const vss = [];
                for (let k = 0; k < ds.get(j).size(); k++) {
                  vss.push(ds.get(j).get(k));
                }
                vs.push(vss);
              }
              values.push(vs);
              displayConfiguration[name] = {
                name: name,
                src: name,
                line_style: "forecast_ruler",
                display: {
                  color: style.color,
                  width: style.width,
                  opacity: style.opacity,
                  style: style.style,
                },
              };
            }
          }
        }
      }

      // 处理涂鸦数据
      if (calRes.doodles && calRes.doodles.size && calRes.doodles.size() > 0) {
        results.metadata.totalDoodles = calRes.doodles.size();
        
        for (let i = 0; i < calRes.doodles.size(); i++) {
          const doodle = calRes.doodles.get(i);
          const name = doodle.name || "anonymous" + anonymousCnt++;
          
          if (doodle.type === 3) { // TEXT
            if (doodle.functionName === "label") {
              const labelName = name + "_label";
              const p = { x: 0, y: 0, text: 0, property: "" };
              
              const func0 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(0), wasmModule);
              p.x = doodle[func0](0).get(0);
              const func1 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(1), wasmModule);
              p.y = doodle[func1](1).get(0);
              const func2 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(2), wasmModule);
              p.text = doodle[func2](2).get(0);
              const func3 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(3), wasmModule);	
              p.property = doodle[func3](3).get(0);
              
              let style = {
                color: "#000000",
                width: 1,
                opacity: "100%",
                style: "solid",
                font: 6,
                bcolor: "#ffffff",
                bopacity: "0.0",
              };
              
              if (p.property) {
                p.property.split(",").forEach(_p => {
                  FormulaParserUtil.generateFontStyle(_p, style);
                });
              }
              
              if (FormulaParserUtil.isValidDoodle([p.x], time_tags.sort())) {
                displayConfiguration[labelName] = {
                  line_style: "doodle_label",
                  display: style,
                  src: {
                    x: p.x,
                    y: p.y,
                    text: p.text,
                    property: p.property,
                  },
                  name: labelName,
                };
              }
            }
          } else {
            if (doodle.functionName === "line") {
              const lineName = name + "_line";
              const p = { start_x: 0, start_y: 0, end_x: 0, end_y: 0, property: "" };
              
              const func0 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(0), wasmModule);
              p.start_x = doodle[func0](0).get(0);
              const func1 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(1), wasmModule);
              p.start_y = doodle[func1](1).get(0);
              const func2 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(2), wasmModule);
              p.end_x = doodle[func2](2).get(0);
              const func3 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(3), wasmModule);
              p.end_y = doodle[func3](3).get(0);
              const func4 = FormulaParserUtil.getFuncName(doodle.variableTypes.get(4), wasmModule);
              p.property = doodle[func4](4).get(0);
              
              let style = { color: "black", width: 1, opacity: "100%", style: "solid" };
              
              if (p.property) {
                p.property.split(",").forEach(_p => {
                  FormulaParserUtil.generateStyle(_p, style);
                });
              }
              
              if (FormulaParserUtil.isValidDoodle([p.start_x, p.end_x], time_tags.sort())) {
                displayConfiguration[lineName] = {
                  line_style: "doodle_line",
                  display: style,
                  src: {
                    start_x: p.start_x,
                    start_y: p.start_y,
                    end_x: p.end_x,
                    end_y: p.end_y,
                    property: p.property,
                  },
                  name: lineName,
                };
              }
            }
          }
        }
      }

      // 构建数据结构
      const data = [];
      for (let i = 0; i < count; i++) {
        const q = {};
        schema.forEach((s, index) => {
          let key = s;
          if (index <= 3) {
            key = "__wolverine_header_" + s;
          }
          q[key] = values[index][i];

          if (s === "time_tag" || s === "granularity" || s === "code") {
            q[s] = q[key];
          }
        });
        data.push(q);
      }

      results.displayConfiguration = displayConfiguration;
      results.data = data;

      // 如果有源代码，解析其中的参数和形状信息
      if (sourcecode) {
        const parsedSource = FormulaParserUtil.parseFormulaSource(sourcecode);
        results.parameters = parsedSource.parameters;
        results.shapes = parsedSource.shapes;
      }

      return results;

    } catch (error) {
      console.error('Error processing formula results:', error);
      return {
        charts: [],
        doodles: [],
        parameters: [],
        shapes: [],
        displayConfiguration: {},
        data: [],
        metadata: {
          totalCharts: 0,
          totalDoodles: 0,
          hasSourcecode: false,
          error: error.message
        }
      };
    }
  }

  /**
   * 生成源代码（反向操作）
   * @param {Object} explainedFormula - 解析后的公式对象
   * @returns {string} 生成的源代码
   */
  static generateSourceCode(explainedFormula) {
    const blocks = FormulaParserUtil.splitToBlocks(
      explainedFormula.originalFormula.source_code
    ).map(l => l.trim());

    const thickRe = /(linethick[:]?\d+)/i;
    const colorRe = /color[:]?[#]?([a-z\d]+)/i;
    const opacityRe = /opacity[:]?([\d.%]+)/i;
    const styleRe = /style[:]?([a-z)]+)/i;
    const bcolorRe = /bcolor[:]?[#]?([a-z\d]+)/i;
    const bopacityRe = /bopacity[:]?[#]?([\d.%]+)/i;
    const fontRe = /font[:]?(\d+)/i;

    // 处理形状
    explainedFormula.shapes.forEach((shape) => {
      let line = blocks[shape.lineNo];
      
      if (line.match(thickRe)) {
        line = line.replace(line.match(thickRe)[0], "LINETHICK:" + shape.lineThick);
      }

      if (line.match(styleRe) && shape.style) {
        line = line.replace(line.match(styleRe)[0], "STYLE:" + shape.style);
      }

      if (line.match(opacityRe) && shape.opacity) {
        blocks[shape.lineNo] = line.replace(
          line.match(opacityRe)[0],
          "OPACITY:" + shape.opacity
        );
      }

      if (line.match(colorRe)) {
        line = line.replace(
          line.match(colorRe)[0],
          "COLOR:" + shape.color.slice(1).toUpperCase()
        );
        if (shape.opacity_mode === 1 && shape.opacity) {
          line = line.replace(
            line.match(colorRe)[0],
            line.match(colorRe)[0] + FormulaParserUtil.rule2(parseInt(shape.opacity))
          );
        }
      }

      // 标签特有属性
      if (line.match(bcolorRe) && shape.bcolor) {
        line = line.replace(
          line.match(bcolorRe)[0],
          "BCOLOR:" + shape.bcolor.slice(1).toUpperCase()
        );
        if (shape.bopacity_mode === 1 && shape.bopacity) {
          line = line.replace(
            line.match(bcolorRe)[0],
            line.match(bcolorRe)[0] + FormulaParserUtil.rule2(parseInt(shape.bopacity))
          );
        }
      }

      if (line.match(bopacityRe) && shape.bopacity && shape.bopacity_mode === 2) {
        line = line.replace(line.match(bopacityRe)[0], "BOPACITY:" + shape.bopacity);
      }

      if (line.match(fontRe) && shape.font) {
        line = line.replace(line.match(fontRe)[0], "FONT:" + shape.font);
      }

      // 线条特殊处理
      if (shape.type === "line") {
        if (!line.match(thickRe)) {
          line = line + ",LINETHICK:" + parseInt(shape.lineThick);
        }

        if (!line.match(styleRe) && shape.style) {
          line = line + ",STYLE:" + shape.style;
        }
      }

      blocks[shape.lineNo] = line;
    });

    // 处理参数
    explainedFormula.parameters.forEach(parameter => {
      let line = blocks[parameter.lineNo];
      line = line.replace(/\s/g, "");
      const re = new RegExp("(" + parameter.parameter + ":=)[^[,|;]+]*", "i");
      blocks[parameter.lineNo] = line.replace(re, "$1" + parameter.value);
    });

    return blocks.join(";\n").replaceAll(FormulaParserUtil.temp_delimiter, "");
  }

  /**
   * 实例方法版本的 processFormulaResults，使用实例的 wasmModule
   * @param {Object} calRes - 公式计算响应对象
   * @param {string} sourcecode - 公式源代码（可选）
   * @returns {Object} 处理后的结果
   */
  processFormulaResults(calRes, sourcecode = null) {
    return FormulaParserUtil.processFormulaResults(calRes, sourcecode, this.wasmModule);
  }
}

export default FormulaParserUtil;
